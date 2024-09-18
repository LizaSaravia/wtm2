import React from 'react';
import {
  Box,
  Text,
  Divider,
  InputGroup,
  Input,
  InputRightElement,
  Button,
  useToast,
} from '@chakra-ui/react';
import { BiCopy } from 'react-icons/bi';

interface CustomInputBoxProps {
  width?: string | number;
  label: string;
  value: string;
  onCopy?: () => void;
}

const CustomInputBox: React.FC<CustomInputBoxProps> = ({
  width,
  label,
  value,
  onCopy,
}) => {
  const toast = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    if (onCopy) {
      onCopy();
    }
    toast({
      title: 'Copied to clipboard 🎉.',
      description: `${label} has been successfully copied to clipboard.`,
      status: 'success',
      duration: 4000,
      isClosable: true,
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        flexDirection: 'column',
      }}
    >
      <Text>{label}:</Text>
      <Divider mb={2} />
      <InputGroup>
        <Input value={value} readOnly variant={'filled'} />
        <InputRightElement>
          <Button h='1.75rem' size='sm' mr={1} onClick={handleCopy}>
            <BiCopy />
          </Button>
        </InputRightElement>
      </InputGroup>
    </Box>
  );
};

export default CustomInputBox;