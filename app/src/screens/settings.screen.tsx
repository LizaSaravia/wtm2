import React from 'react';
import { Text, IconButton } from '@chakra-ui/react';
import { SmallCloseIcon } from '@chakra-ui/icons';
import { useNavigationStore } from '../store';
import { useLogout } from '../hooks/use-logout.hook';

export const SettingsScreen: React.FC<object> = () => {
  const { navigateBack, navigateTo } = useNavigationStore();
  const { logout } = useLogout();

  return (
    <>
      <div className='flex flex-col px-5 py-3 bg-slate-100 min-h-screen items-center w-full'>
        <div className='flex w-full justify-end'>
          <IconButton aria-label='Settings icon'>
            <SmallCloseIcon boxSize={5} onClick={() => navigateBack()} />
          </IconButton>
        </div>
        <div className='pb-4'>
          <Text fontSize={'xx-large'} fontWeight={'bold'}>
            Settings
          </Text>
        </div>
        <div className='flex flex-col w-full min-h-[400px]'>
          <div
            className='flex w-full py-2 cursor-pointer border-b border-solid border-[#333]'
            onClick={() => navigateTo('preferencies')}
          >
            <Text fontSize={'medium'}>Preferencies</Text>
          </div>
          <div className='flex w-full py-2 cursor-pointer border-b border-solid border-[#333]'>
            <Text fontSize={'medium'}>Active Sessions</Text>
          </div>
          <div className='flex w-full py-2 cursor-pointer border-b border-solid border-[#333]'>
            <Text fontSize={'medium'} color={'red'}>
              Delete account
            </Text>
          </div>
        </div>
        <div
          className='flex w-full py-2 cursor-pointer justify-center'
          onClick={logout}
        >
          <Text fontSize={'medium'}>Logout</Text>
        </div>
      </div>
    </>
  );
};
