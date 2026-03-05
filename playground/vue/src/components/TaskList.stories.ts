import type { Meta, StoryObj } from '@storybook/vue3-vite';
import TaskList from './TaskList.vue';
import Button from './Button.vue';
import TaskCard from './TaskCard.vue';

const meta: Meta<typeof TaskList> = {
  component: TaskList,
};

const html = String.raw;

export default meta;
type Story = StoryObj<typeof TaskList>;

export const Default: Story = {
  render: (args) => ({
    components: { TaskList, Button, TaskCard },
    setup() {
      const componentArgs = Object.fromEntries(
        Object.entries(args).filter(([key]) => !key.startsWith('slot:')),
      );
      return { componentArgs };
    },
    template: html`
<TaskList v-bind="componentArgs">
  <TaskCard :task='{"id":"1","title":"Review component highlighter PR","status":"in-progress","metadata":{"priority":"high","dueDate":"Today","assignee":{"name":"Alice"}}}' @action="() => {}" />
  <TaskCard :task='{"id":"2","title":"Write documentation for new features","status":"pending","metadata":{"priority":"medium","dueDate":"Tomorrow","assignee":{"name":"Bob"}}}' @action="() => {}" />
  <TaskCard :task='{"id":"3","title":"Update dependencies to latest versions","status":"completed","metadata":{"priority":"low","dueDate":"Yesterday","assignee":{"name":"Charlie"}}}' @action="() => {}" />
  <Button variant="secondary" @click="() => {}">Load more</Button>
</TaskList>`,
  }),
  args: {
    title: "All Tasks",
    count: 3,
  },
};

export const WithExtraChild: Story = {
  render: (args) => ({
    components: { TaskList, Button, TaskCard },
    setup() {
      const componentArgs = Object.fromEntries(
        Object.entries(args).filter(([key]) => !key.startsWith('slot:')),
      );
      return { componentArgs };
    },
    template: `<TaskList v-bind="componentArgs"><div :style='{"border":"1px solid orange"}'>This is some static HTML.</div><TaskCard :task='{"id":"1","title":"Review component highlighter PR","status":"in-progress","metadata":{"priority":"high","dueDate":"Today","assignee":{"name":"Alice"}}}' @action="() => {}" /><TaskCard :task='{"id":"2","title":"Write documentation for new features","status":"pending","metadata":{"priority":"medium","dueDate":"Tomorrow","assignee":{"name":"Bob"}}}' @action="() => {}" /><TaskCard :task='{"id":"3","title":"Update dependencies to latest versions","status":"completed","metadata":{"priority":"low","dueDate":"Yesterday","assignee":{"name":"Charlie"}}}' @action="() => {}" /><Button variant="secondary" @click="() => {}">Load more</Button></TaskList>`,
  }),
  args: {
    title: "All Tasks",
    count: 3,
  },
};

export const WithLocalComp: Story = {
  render: (args) => ({
    components: { TaskList, Button, MyLocalComponent, TaskCard },
    setup() {
      const componentArgs = Object.fromEntries(
        Object.entries(args).filter(([key]) => !key.startsWith('slot:')),
      );
      return { componentArgs };
    },
    template: `<TaskList v-bind="componentArgs"><div :style='{"border":"1px solid orange","padding":"8px"}'>This is some static HTML.</div><MyLocalComponent>This is a local, unexported component.</MyLocalComponent><TaskCard :task='{"id":"1","title":"Review component highlighter PR","status":"in-progress","metadata":{"priority":"high","dueDate":"Today","assignee":{"name":"Alice"}}}' @action="() => {}" /><TaskCard :task='{"id":"2","title":"Write documentation for new features","status":"pending","metadata":{"priority":"medium","dueDate":"Tomorrow","assignee":{"name":"Bob"}}}' @action="() => {}" /><TaskCard :task='{"id":"3","title":"Update dependencies to latest versions","status":"completed","metadata":{"priority":"low","dueDate":"Yesterday","assignee":{"name":"Charlie"}}}' @action="() => {}" /><Button variant="secondary" @click="() => {}">Load more</Button></TaskList>`,
  }),
  args: {
    title: "All Tasks",
    count: 3,
  },
};
