import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MyButton } from './Button';

const meta: Meta<typeof MyButton> = {
  component: MyButton,
};

export default meta;
type Story = StoryObj<typeof MyButton>;

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary",
  },
};

