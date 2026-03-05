import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import TaskCard from './TaskCard.vue';

const meta: Meta<typeof TaskCard> = {
  component: TaskCard,
};

export default meta;
type Story = StoryObj<typeof TaskCard>;

export const Default: Story = {
  args: {
    task: {
      id: "1",
      title: "Review component highlighter PR",
      status: "in-progress",
      metadata: {
        priority: "high",
        dueDate: "Today",
        assignee: {
          name: "Alice",
        },
      },
    },
    onAction: fn(),
  },
};
