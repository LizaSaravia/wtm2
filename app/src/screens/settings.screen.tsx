import React from 'react';
import { Text, IconButton, Button } from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { useLogout } from '../hooks';
import { useNavigation } from '../store';

export const SettingsScreen: React.FC<object> = () => {
  const { navigateBack, navigateTo } = useNavigation();
  const { logout } = useLogout();

  return (
    <>
      <div className='flex flex-col px-5 py-3 bg-slate-100 items-center w-full'>
        <div className='flex w-full justify-start pb-4 gap-4 items-center'>
          <IconButton aria-label='Settings icon' onClick={() => navigateBack()}>
            <ArrowBackIcon boxSize={5} />
          </IconButton>
          <div className='flex w-full justify-center pr-[40px]'>
            <Text fontSize={'xx-large'} fontWeight={'bold'}>
              Settings
            </Text>
          </div>
        </div>
        <div className='flex flex-col w-full min-h-[400px]'>
          <div
            className='flex w-full py-2 cursor-pointer border-b border-solid border-[#333]'
            onClick={() => navigateTo('preferences')}
          >
            <Text fontSize={'medium'}>Preferences</Text>
          </div>
          <div
            className='flex w-full py-2 cursor-pointer border-b border-solid border-[#333]'
            onClick={() => navigateTo('active-sessions')}
          >
            <Text fontSize={'medium'}>Active Sessions</Text>
          </div>
          <div
            className='flex w-full py-2 cursor-pointer border-b border-solid border-[#333]'
            onClick={() => navigateTo('confirm-delete-account')}
          >
            <Text fontSize={'medium'} color={'red'}>
              Delete account
            </Text>
          </div>
        </div>
        <div className='flex w-full py-2 cursor-pointer justify-center'>
          <Button onClick={logout}>Logout</Button>
        </div>
      </div>
    </>
  );
};