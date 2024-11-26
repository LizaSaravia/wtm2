import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NavigationEntry, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { JwtContext } from '../../auth/interfaces';

import {
  CompleteNavigationEntryDto,
  CreateNavigationEntryInputDto,
  GetNavigationEntryDto,
  DeleteNavigationEntriesDto,
  AddContextToNavigationEntryDto,
} from '../dtos';

import {
  CompleteNavigationEntry,
  completeNavigationEntryInclude,
  countNavigationEntriesQueryRaw,
  navigationEntriesQueryRaw,
  RawCompleteNavigationEntry,
  transformRawToCompleteNavigationEntries,
} from '../types';

import { MessageResponse, PaginationResponse } from '../../common/dtos';
import { PrismaService } from '../../common/services';

import { UserService } from '../../user/services';
import { CompleteUser } from '../../user/types';

import { ExplicitFilterService } from '../../filter/services';
import { appEnv } from '../../config';
import { subDays } from 'date-fns';
import { CustomLogger } from '../../common/helpers/custom-logger';
import { OpenAI } from '@langchain/openai';
import { z } from 'zod';

const SummaryPromptSchema = z.object({
  data: z.object({
    content: z.string(),
    tags: z.array(z.string()),
    source: z.string(),
  }),
});
type SummaryPromptResponse = z.infer<typeof SummaryPromptSchema>;

@Injectable()
export class NavigationEntryService {
  private readonly logger = new CustomLogger(NavigationEntryService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly explicitFilter: ExplicitFilterService,
  ) {}

  static getExpitationDate(
    user: CompleteUser,
    navigationEntry: NavigationEntry,
  ): Date | undefined {
    const enableNavigationEntryExpiration =
      user?.userPreferences?.enableNavigationEntryExpiration;
    const navigationEntryExpirationInDays =
      user?.userPreferences?.navigationEntryExpirationInDays;

    if (enableNavigationEntryExpiration && navigationEntryExpirationInDays) {
      const expirationDate = new Date(navigationEntry.navigationDate);
      expirationDate.setDate(
        expirationDate.getDate() + navigationEntryExpirationInDays,
      );
      return expirationDate;
    }
  }

  static completeNavigationEntryToDto(
    jwtContext: JwtContext,
    completeNavigationEntry: CompleteNavigationEntry,
  ): CompleteNavigationEntryDto {
    const userDeviceDto = UserService.userDeviceToDto(
      jwtContext,
      completeNavigationEntry.userDevice,
    );
    const completeNavigationEntryDto = plainToInstance(
      CompleteNavigationEntryDto,
      {
        ...completeNavigationEntry,
        id: Number(completeNavigationEntry.id),
        userId: Number(completeNavigationEntry.userId),
        userDeviceId: Number(completeNavigationEntry.userDeviceId),
        expirationDate: NavigationEntryService.getExpitationDate(
          jwtContext.user,
          completeNavigationEntry,
        ),
        aiGeneratedContent: completeNavigationEntry.aiGeneratedContent,
        tags:
          completeNavigationEntry?.entryTags?.map((entry) => entry.tag.name) ||
          [],
      },
    );
    completeNavigationEntryDto.userDevice = userDeviceDto;
    return completeNavigationEntryDto;
  }

  static completeNavigationEntriesToDtos(
    jwtContext: JwtContext,
    completeNavigationEntries: CompleteNavigationEntry[],
  ): CompleteNavigationEntryDto[] {
    return completeNavigationEntries.map((completeNavigationEntry) =>
      NavigationEntryService.completeNavigationEntryToDto(
        jwtContext,
        completeNavigationEntry,
      ),
    );
  }

  getNavigationEntryExpirationInDays(user: CompleteUser): number | undefined {
    const enableNavigationEntryExpiration =
      user?.userPreferences?.enableNavigationEntryExpiration;
    const navigationEntryExpirationInDays =
      user?.userPreferences?.navigationEntryExpirationInDays;

    if (enableNavigationEntryExpiration && navigationEntryExpirationInDays) {
      return navigationEntryExpirationInDays;
    }
  }

  private async saveTags(
    navEntry: NavigationEntry,
    parsedData: SummaryPromptResponse,
    prismaClient: Prisma.TransactionClient,
  ) {
    const tags = parsedData.data.tags;

    await prismaClient.tag.createMany({
      data: tags.map((tagName) => ({ name: tagName })),
      skipDuplicates: true,
    });

    const allTags = await prismaClient.tag.findMany({
      where: { name: { in: tags } },
      select: { id: true },
    });

    await prismaClient.entryTag.createMany({
      data: allTags.map((tag) => ({
        entryId: navEntry.id,
        tagId: tag.id,
      })),
      skipDuplicates: true,
    });
  }

  async createNavigationEntry(
    jwtContext: JwtContext,
    createNavigationEntryInputDto: CreateNavigationEntryInputDto,
  ): Promise<void> {
    const domains = appEnv.AVOID_DOMAIN_LIST;
    const noTrackingDomains = (domains && domains.split(', ')) || [];

    const { hostname } = new URL(createNavigationEntryInputDto.url);

    if (hostname && noTrackingDomains.includes(hostname)) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, images, ...entryData } = createNavigationEntryInputDto;

    const liteMode = !content;

    if (!liteMode) {
      const userPreference = await this.prismaService.userPreferences.findFirst(
        {
          where: {
            userId: jwtContext.user.id,
          },
          select: {
            enableImageEncoding: true,
            enableExplicitContentFilter: true,
            enableStopTracking: true,
          },
        },
      );
      if (userPreference?.enableStopTracking) {
        return;
      }

      if (userPreference?.enableExplicitContentFilter) {
        await this.explicitFilter.filter(
          content!,
          createNavigationEntryInputDto.url,
        );
      }
    }

    const lastEntry = await this.prismaService.navigationEntry.findFirst({
      where: {
        userId: jwtContext.user.id,
      },
      take: 1,
      orderBy: {
        navigationDate: 'desc',
      },
    });

    const openai = new OpenAI({
      openAIApiKey: appEnv.OPENAI_ACCESS_TOKEN,
      modelName: 'gpt-4o-mini',
      temperature: 0.8,
    });

    const formatPrompt = `
      # IDENTITY and PURPOSE
  
      You are an expert content summarizer. You take semantic markdown content in and output a Markdown formatted summary using the format below. Also, you are an expert code formatter in markdown, making code more legible and well formatted.
  
      Take a deep breath and think step by step about how to best accomplish this goal using the following steps.
  
      # OUTPUT SECTIONS
  
      - Combine all of your understanding of the content into a single, 20-word sentence in a section called Summary:.
      - Output the 10 if exists, including most important points of the content as a list with no more than 15 words per point into a section called Main Points:.
      - Output a list of the 5 best takeaways from the content in a section called Takeaways:.
      - Output code must be formatted with Prettier like.
      - Output a section named Code: that shows a list of code present in INPUT content in markdown
      - All previous outputs must be inside a property called content, which contains a single string with all the markdown
      - Output a property on the object called tags that shows in a list of the most relevant tags present in the input content
      - Output a property on the object called source that has the link of the content in a string
  
      # OUTPUT INSTRUCTIONS
      - Create the output using the formatting above.
      - You only output human readable Markdown.
      - Sections MUST be in capital case.
      - Sections must be h2 to lower.
      - Output numbered lists, not bullets.
      - Do not output warnings or notes—just the requested sections.
      - Do not repeat items in the output sections.
      - Do not start items with the same opening words.
      - Do not show Code: section if no code is present on input provided.
      - You must detect the type of code and add it to code block so markdown styles are applied.
      - Set codes proper language if you can detect it.
      - Detect code and apply format to it.
      - The wrapped tags must be tags that you find from page information.
      - Tags must be a link that redirects to source url.
      - The object result must be in JSON format
      - Object must be clean, the response starts with { and finishes with }
      - Objects value is: data
      - Object MUST have the following unique properties inside data: content, tags, source
      - Each tag in object must be a list of strings
      - Each tags name must be un uppercase, if a space or a . separates 2 words, apply a _ for separating
      - Quantity of tags must be lower to 5
      - Tags language must be en english, no matter the language of the content.
      # INPUT:
  
      INPUT:
  
      The search result is:
  
      ### Source: ${createNavigationEntryInputDto.url}
      ${content}
      `;

    const formattedResult = await openai.invoke([formatPrompt]);
    const jsonParseFormattedResult = JSON.parse(formattedResult);

    const parsedData = SummaryPromptSchema.safeParse(jsonParseFormattedResult);

    if (parsedData.success) {
      await this.prismaService.$transaction(async (prismaClient) => {
        if (lastEntry?.url === createNavigationEntryInputDto.url) {
          const navEntry = await prismaClient.navigationEntry.update({
            where: {
              id: lastEntry.id,
            },
            data: {
              liteMode,
              userDeviceId: jwtContext.session.userDeviceId,
              aiGeneratedContent: parsedData.data?.data.content,
              ...entryData,
            },
            include: completeNavigationEntryInclude,
          });
          await prismaClient.entryTag.deleteMany({
            where: {
              entryId: navEntry.id,
            },
          });
          await this.saveTags(navEntry, parsedData.data, prismaClient);
        } else {
          const navEntry = await prismaClient.navigationEntry.create({
            data: {
              liteMode,
              userId: jwtContext.user.id,
              userDeviceId: jwtContext.session.userDeviceId,
              aiGeneratedContent: parsedData.data?.data.content,
              ...entryData,
            },
            include: completeNavigationEntryInclude,
          });
          await this.saveTags(navEntry, parsedData.data, prismaClient);
        }
      });
    } else {
      console.error('Error parsing formatted result:', parsedData.error);
    }
    return;
  }

  async addContextToNavigationEntry(
    jwtContext: JwtContext,
    addContextToNavigationEntryDto: AddContextToNavigationEntryDto,
  ) {
    try {
      const { content } = addContextToNavigationEntryDto;

      const userPreference = await this.prismaService.userPreferences.findFirst(
        {
          where: {
            userId: jwtContext.user.id,
          },
          select: {
            enableExplicitContentFilter: true,
          },
        },
      );

      if (userPreference?.enableExplicitContentFilter) {
        await this.explicitFilter.filter(
          content!,
          addContextToNavigationEntryDto.url,
        );
      }
    } catch (error) {
      this.logger.error(
        `An error occurred indexing '${addContextToNavigationEntryDto.url}'. Cause: ${error.message}`,
      );
    }
  }

  async getNavigationEntry(
    jwtContext: JwtContext,
    queryParams: GetNavigationEntryDto,
  ): Promise<PaginationResponse<CompleteNavigationEntryDto>> {
    const { limit, offset, tag, query } = queryParams;
    const queryTsVector = queryParams.queryTsVector
      ? queryParams.queryTsVector.trim()
      : undefined;
    const navigationEntryExpirationInDays =
      this.getNavigationEntryExpirationInDays(jwtContext.user);

    let expirationThreshold: Date | undefined;
    if (navigationEntryExpirationInDays) {
      expirationThreshold = new Date();
      expirationThreshold.setDate(
        expirationThreshold.getDate() - navigationEntryExpirationInDays,
      );
    }
    let whereQuery: Prisma.NavigationEntryWhereInput = {};

    const queryFilter: Prisma.StringFilter<'NavigationEntry'> = {
      contains: query,
      mode: 'insensitive',
    };

    whereQuery = {
      ...(query !== undefined
        ? { OR: [{ url: queryFilter }, { title: queryFilter }] }
        : {}),
      ...(expirationThreshold
        ? {
            navigationDate: {
              gte: expirationThreshold,
            },
          }
        : {}),
    };

    let count: number = 0;
    let completeNavigationEntries: CompleteNavigationEntry[] = [];
    const userId = jwtContext.user.id;

    if (queryTsVector) {
      const tokens = queryTsVector
        .toLowerCase()
        .split(' ')
        .filter((v) => v);

      const tsqueryTerm = tokens.join(' | ');
      const similarTerm = `%(${tokens.join('|')})%`;

      const keywords = tsqueryTerm;
      const similarPattern = similarTerm;

      const countResult: { count: number }[] =
        await this.prismaService.$queryRawUnsafe(
          countNavigationEntriesQueryRaw,
          userId,
          keywords,
          similarPattern,
          similarPattern,
        );

      const rawCompleteNavigationEntries: RawCompleteNavigationEntry[] =
        await this.prismaService.$queryRawUnsafe(
          navigationEntriesQueryRaw,
          userId,
          keywords,
          similarPattern,
          similarPattern,
          limit,
          offset,
        );

      const entriesResult = transformRawToCompleteNavigationEntries(
        rawCompleteNavigationEntries,
      );

      count = countResult?.[0].count || 0;
      completeNavigationEntries = entriesResult;
    } else {
      whereQuery = {
        ...whereQuery,
        ...(tag && {
          entryTags: {
            some: {
              tag: {
                name: tag,
              },
            },
          },
        }),
      };

      count = await this.prismaService.navigationEntry.count({
        where: {
          userId,
          ...whereQuery,
        },
      });

      completeNavigationEntries =
        await this.prismaService.navigationEntry.findMany({
          where: {
            userId,
            ...whereQuery,
          },
          include: completeNavigationEntryInclude,
          skip: offset,
          take: limit,
          orderBy: {
            navigationDate: 'desc',
          },
        });
    }

    const completeNavigationEntryDtos =
      NavigationEntryService.completeNavigationEntriesToDtos(
        jwtContext,
        completeNavigationEntries,
      );

    const userQuery = query ? query : queryTsVector;
    return plainToInstance(PaginationResponse<CompleteNavigationEntryDto>, {
      offset,
      limit,
      count,
      query: userQuery,
      items: completeNavigationEntryDtos,
    });
  }

  async deleteNavigationEntry(
    jwtContext: JwtContext,
    id: number,
  ): Promise<MessageResponse> {
    const navigationEntry = await this.prismaService.navigationEntry.findUnique(
      {
        where: {
          userId: jwtContext.user.id,
          id,
        },
      },
    );

    if (!navigationEntry) {
      throw new NotFoundException();
    }
    await this.prismaService.navigationEntry.delete({
      where: { id, userId: jwtContext.user.id },
    });

    return plainToInstance(MessageResponse, {
      message: 'Navigation entry has been deleted',
    });
  }

  async deleteNavigationEntries(
    jwtContext: JwtContext,
    deleteNavigationEntriesDto: DeleteNavigationEntriesDto,
  ): Promise<MessageResponse> {
    const { navigationEntryIds } = deleteNavigationEntriesDto;

    const entries = await this.prismaService.navigationEntry.findMany({
      where: {
        id: { in: navigationEntryIds },
        userId: jwtContext.user.id,
      },
    });

    if (entries.length !== navigationEntryIds.length) {
      throw new ForbiddenException();
    }

    await this.prismaService.$transaction(async (prismaClient) => {
      await prismaClient.navigationEntry.deleteMany({
        where: {
          id: { in: navigationEntryIds },
          userId: jwtContext.user.id,
        },
      });
    });

    return plainToInstance(MessageResponse, {
      message: `${entries.length} navigation entries have been deleted`,
    });
  }

  async deleteExpiredNavigationEntries(): Promise<void> {
    try {
      console.log(`deleteExpiredNavigationEntries has started`);
      const userPreferences = await this.prismaService.userPreferences.findMany(
        {
          where: {
            enableNavigationEntryExpiration: true,
            navigationEntryExpirationInDays: {
              not: null,
            },
          },
          select: {
            userId: true,
            navigationEntryExpirationInDays: true,
          },
        },
      );
      if (userPreferences.length === 0) {
        console.log(`There is no entries to delete`);
        return;
      }
      await Promise.allSettled(
        userPreferences.map(async (preference) => {
          const { userId, navigationEntryExpirationInDays } = preference;

          const expirationDate = subDays(
            new Date(),
            navigationEntryExpirationInDays!,
          );

          try {
            const entries = await this.prismaService.navigationEntry.findMany({
              where: {
                userId: userId,
                createdAt: {
                  lt: expirationDate,
                },
              },
              take: 50,
            });

            const entriesToDelete = entries.map((entry) => entry.id);
            await this.prismaService.navigationEntry.deleteMany({
              where: {
                id: {
                  in: entriesToDelete,
                },
              },
            });
          } catch (error) {
            console.error(`Error getting entries of user ${userId}:`, error);
          }
        }),
      ).catch((error) => {
        console.error('Error deleting expired navigation entries:', error);
      });
      console.log(`deleteExpiredNavigationEntries has finished`);
    } catch (error) {
      console.error('Error executing process', error);
    }
  }
}
