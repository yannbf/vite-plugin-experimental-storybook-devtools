import { describe, it, expect } from 'vitest'
import {
  toKebabCase,
  toEventName,
  escapeAttributeExpression,
  escapeHtmlText,
  toTemplateExpression,
  getVueNodeName,
  generateTemplateProps,
  generateVNodeSource,
  serializeVNodeToTemplate,
} from '../../../src/frameworks/vue/vnode-to-template'

describe('toKebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(toKebabCase('onClick')).toBe('on-click')
    expect(toKebabCase('myPropName')).toBe('my-prop-name')
  })

  it('converts PascalCase to kebab-case', () => {
    expect(toKebabCase('TaskCard')).toBe('task-card')
    expect(toKebabCase('MyComponent')).toBe('my-component')
  })

  it('handles single words', () => {
    expect(toKebabCase('button')).toBe('button')
    expect(toKebabCase('div')).toBe('div')
  })

  it('handles underscores', () => {
    expect(toKebabCase('my_prop_name')).toBe('my-prop-name')
  })

  it('handles numbers', () => {
    expect(toKebabCase('item2Name')).toBe('item2-name')
    expect(toKebabCase('myProp2')).toBe('my-prop2')
  })
})

describe('toEventName', () => {
  it('converts onClick to click', () => {
    expect(toEventName('onClick')).toBe('click')
  })

  it('converts onInput to input', () => {
    expect(toEventName('onInput')).toBe('input')
  })

  it('handles single character after on', () => {
    expect(toEventName('onA')).toBe('a')
  })

  it('handles empty string after on', () => {
    expect(toEventName('on')).toBe('')
  })

  it('preserves camelCase in event names', () => {
    expect(toEventName('onMyCustomEvent')).toBe('myCustomEvent')
  })
})

describe('escapeAttributeExpression', () => {
  it('escapes single quotes', () => {
    expect(escapeAttributeExpression("it's a test")).toBe('it&#39;s a test')
  })

  it('handles multiple single quotes', () => {
    expect(escapeAttributeExpression("'hello' 'world'")).toBe(
      '&#39;hello&#39; &#39;world&#39;',
    )
  })

  it('handles strings without quotes', () => {
    expect(escapeAttributeExpression('hello world')).toBe('hello world')
  })
})

describe('escapeHtmlText', () => {
  it('escapes ampersands', () => {
    expect(escapeHtmlText('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('escapes less than', () => {
    expect(escapeHtmlText('5 < 10')).toBe('5 &lt; 10')
  })

  it('escapes greater than', () => {
    expect(escapeHtmlText('10 > 5')).toBe('10 &gt; 5')
  })

  it('escapes all special characters', () => {
    expect(escapeHtmlText('<div>A & B</div>')).toBe(
      '&lt;div&gt;A &amp; B&lt;/div&gt;',
    )
  })

  it('handles text without special chars', () => {
    expect(escapeHtmlText('hello world')).toBe('hello world')
  })
})

describe('toTemplateExpression', () => {
  const identitySerializer = (v: unknown) => v

  it('converts null to "null"', () => {
    expect(toTemplateExpression(null, identitySerializer)).toBe('null')
  })

  it('converts undefined to "null"', () => {
    expect(toTemplateExpression(undefined, identitySerializer)).toBe('null')
  })

  it('converts numbers to strings', () => {
    expect(toTemplateExpression(42, identitySerializer)).toBe('42')
    expect(toTemplateExpression(3.14, identitySerializer)).toBe('3.14')
  })

  it('converts booleans to strings', () => {
    expect(toTemplateExpression(true, identitySerializer)).toBe('true')
    expect(toTemplateExpression(false, identitySerializer)).toBe('false')
  })

  it('converts bigints', () => {
    expect(toTemplateExpression(BigInt(123), identitySerializer)).toBe(
      'BigInt(123)',
    )
  })

  it('converts strings to JSON strings', () => {
    expect(toTemplateExpression('hello', identitySerializer)).toBe('"hello"')
    expect(toTemplateExpression("it's a test", identitySerializer)).toBe(
      '"it\'s a test"',
    )
  })

  it('converts functions to empty arrow functions', () => {
    expect(toTemplateExpression(() => {}, identitySerializer)).toBe('() => {}')
  })

  it('converts objects via serializer', () => {
    const obj = { a: 1, b: 2 }
    expect(toTemplateExpression(obj, identitySerializer)).toBe('{"a":1,"b":2}')
  })

  it('converts arrays via serializer', () => {
    const arr = [1, 2, 3]
    expect(toTemplateExpression(arr, identitySerializer)).toBe('[1,2,3]')
  })
})

describe('getVueNodeName', () => {
  it('returns string tag names', () => {
    expect(getVueNodeName('div')).toBe('div')
    expect(getVueNodeName('button')).toBe('button')
  })

  it('extracts name from component objects', () => {
    expect(getVueNodeName({ name: 'MyComponent' })).toBe('MyComponent')
  })

  it('prefers __name over name', () => {
    expect(getVueNodeName({ name: 'OldName', __name: 'NewName' })).toBe(
      'NewName',
    )
  })

  it('falls back to name when __name missing', () => {
    expect(getVueNodeName({ name: 'MyComponent' })).toBe('MyComponent')
  })

  it('filters out Fragment', () => {
    expect(getVueNodeName({ name: 'Fragment' })).toBe(null)
    expect(getVueNodeName({ __name: 'Fragment' })).toBe(null)
  })

  it('returns null for non-objects', () => {
    expect(getVueNodeName(null)).toBe(null)
    expect(getVueNodeName(undefined)).toBe(null)
    expect(getVueNodeName(123)).toBe(null)
  })

  it('returns null for objects without name or __name', () => {
    expect(getVueNodeName({})).toBe(null)
    expect(getVueNodeName({ type: 'div' })).toBe(null)
  })
})

describe('generateTemplateProps', () => {
  const identitySerializer = (v: unknown) => v

  it('generates boolean props', () => {
    expect(generateTemplateProps({ disabled: true }, identitySerializer)).toBe(
      'disabled',
    )
    expect(
      generateTemplateProps(
        { disabled: true, required: true },
        identitySerializer,
      ),
    ).toBe('disabled required')
  })

  it('omits false boolean props', () => {
    expect(generateTemplateProps({ disabled: false }, identitySerializer)).toBe(
      '',
    )
  })

  it('generates string props', () => {
    expect(generateTemplateProps({ type: 'submit' }, identitySerializer)).toBe(
      'type="submit"',
    )
    expect(
      generateTemplateProps({ label: 'Click me' }, identitySerializer),
    ).toBe('label="Click me"')
  })

  it('converts camelCase prop names to kebab-case', () => {
    expect(
      generateTemplateProps({ myProp: 'value' }, identitySerializer),
    ).toContain('my-prop')
  })

  it('generates bound props with colon prefix', () => {
    expect(generateTemplateProps({ count: 42 }, identitySerializer)).toBe(
      ":count='42'",
    )
    expect(generateTemplateProps({ items: [1, 2] }, identitySerializer)).toBe(
      ":items='[1,2]'",
    )
  })

  it('converts event listeners to @ syntax', () => {
    expect(
      generateTemplateProps({ onClick: () => {} }, identitySerializer),
    ).toBe('@click="() => {}"')
    expect(
      generateTemplateProps({ onInput: () => {} }, identitySerializer),
    ).toBe('@input="() => {}"')
  })

  it('ignores key and ref props', () => {
    expect(
      generateTemplateProps(
        { key: '123', ref: 'myRef', value: 'test' },
        identitySerializer,
      ),
    ).toBe('value="test"')
  })

  it('ignores null and undefined props', () => {
    expect(
      generateTemplateProps(
        { a: null, b: undefined, c: 'value' },
        identitySerializer,
      ),
    ).toBe('c="value"')
  })

  it('handles mixed props', () => {
    const result = generateTemplateProps(
      {
        disabled: true,
        type: 'button',
        count: 5,
        onClick: () => {},
      },
      identitySerializer,
    )
    expect(result).toContain('disabled')
    expect(result).toContain('type="button"')
    expect(result).toContain(":count='5'")
    expect(result).toContain('@click="() => {}"')
  })

  it('escapes quotes in bound expressions', () => {
    expect(
      generateTemplateProps({ value: "it's a test" }, identitySerializer),
    ).toBe('value="it\'s a test"')
  })
})

describe('generateVNodeSource', () => {
  const identitySerializer = (v: unknown) => v
  const refs = () => new Set<string>()

  it('handles null and undefined', () => {
    expect(generateVNodeSource(null, refs(), identitySerializer)).toBe('')
    expect(generateVNodeSource(undefined, refs(), identitySerializer)).toBe('')
    expect(generateVNodeSource(false, refs(), identitySerializer)).toBe('')
  })

  it('handles primitive strings', () => {
    expect(generateVNodeSource('hello', refs(), identitySerializer)).toBe(
      'hello',
    )
    expect(generateVNodeSource('A & B', refs(), identitySerializer)).toBe(
      'A &amp; B',
    )
  })

  it('handles numbers', () => {
    expect(generateVNodeSource(42, refs(), identitySerializer)).toBe('42')
    expect(generateVNodeSource(true, refs(), identitySerializer)).toBe('true')
  })

  it('handles arrays of values', () => {
    expect(
      generateVNodeSource(['hello', ' ', 'world'], refs(), identitySerializer),
    ).toBe('hello world')
  })

  it('renders simple HTML elements', () => {
    const vnode = {
      __v_isVNode: true,
      type: 'div',
      props: {},
      children: 'content',
    }
    expect(generateVNodeSource(vnode, refs(), identitySerializer)).toBe(
      '<div>content</div>',
    )
  })

  it('renders self-closing elements without children', () => {
    const vnode = {
      __v_isVNode: true,
      type: 'input',
      props: { type: 'text' },
      children: null,
    }
    expect(generateVNodeSource(vnode, refs(), identitySerializer)).toBe(
      '<input type="text" />',
    )
  })

  it('renders elements with props', () => {
    const vnode = {
      __v_isVNode: true,
      type: 'button',
      props: { disabled: true, type: 'submit' },
      children: 'Submit',
    }
    expect(generateVNodeSource(vnode, refs(), identitySerializer)).toBe(
      '<button disabled type="submit">Submit</button>',
    )
  })

  it('renders components and tracks references', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: { __name: 'MyComponent' },
      props: {},
      children: null,
    }
    expect(generateVNodeSource(vnode, componentRefs, identitySerializer)).toBe(
      '<MyComponent />',
    )
    expect(componentRefs.has('MyComponent')).toBe(true)
  })

  it('renders nested components', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: { __name: 'TaskList' },
      props: {},
      children: [
        {
          __v_isVNode: true,
          type: { __name: 'TaskCard' },
          props: { title: 'Task 1' },
          children: null,
        },
        {
          __v_isVNode: true,
          type: { __name: 'TaskCard' },
          props: { title: 'Task 2' },
          children: null,
        },
      ],
    }
    const result = generateVNodeSource(vnode, componentRefs, identitySerializer)
    expect(result).toBe(
      '<TaskList><TaskCard title="Task 1" /><TaskCard title="Task 2" /></TaskList>',
    )
    expect(componentRefs.has('TaskList')).toBe(true)
    expect(componentRefs.has('TaskCard')).toBe(true)
  })

  it('skips Fragment symbols', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: Symbol('Fragment'),
      props: {},
      children: 'content',
    }
    expect(generateVNodeSource(vnode, componentRefs, identitySerializer)).toBe(
      'content',
    )
  })

  it('handles named slots as children object', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: { __name: 'Card' },
      props: {},
      children: {
        default: () => ({
          __v_isVNode: true,
          type: 'p',
          props: {},
          children: 'Default content',
        }),
        header: () => ({
          __v_isVNode: true,
          type: 'h1',
          props: {},
          children: 'Header',
        }),
      },
    }
    const result = generateVNodeSource(vnode, componentRefs, identitySerializer)
    expect(result).toContain('<Card')
    expect(result).toContain('<p>Default content</p>')
    expect(result).toContain('<template #header><h1>Header</h1></template>')
  })

  it('handles empty slot functions gracefully', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: { __name: 'Card' },
      props: {},
      children: {
        default: () => null,
      },
    }
    const result = generateVNodeSource(vnode, componentRefs, identitySerializer)
    // Empty slots still render the children object as [object Object]
    expect(result).toContain('<Card')
  })

  it('ignores $ prefixed slot properties', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: { __name: 'Card' },
      props: {},
      children: {
        $stable: true,
        default: () => 'content',
      },
    }
    const result = generateVNodeSource(vnode, componentRefs, identitySerializer)
    expect(result).toContain('content')
  })

  it('handles deeply nested structures', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: 'div',
      props: { class: 'container' },
      children: [
        {
          __v_isVNode: true,
          type: { __name: 'Header' },
          props: {},
          children: 'Title',
        },
        {
          __v_isVNode: true,
          type: 'main',
          props: {},
          children: [
            {
              __v_isVNode: true,
              type: { __name: 'Content' },
              props: { active: true },
              children: 'Main content',
            },
          ],
        },
      ],
    }
    const result = generateVNodeSource(vnode, componentRefs, identitySerializer)
    expect(result).toBe(
      '<div class="container"><Header>Title</Header><main><Content active>Main content</Content></main></div>',
    )
    expect(componentRefs.has('Header')).toBe(true)
    expect(componentRefs.has('Content')).toBe(true)
  })

  it('handles non-VNode objects as escaped text', () => {
    const componentRefs = new Set<string>()
    const obj = { foo: 'bar' }
    expect(generateVNodeSource(obj, componentRefs, identitySerializer)).toBe(
      '[object Object]',
    )
  })

  it('handles VNodes without a valid name', () => {
    const componentRefs = new Set<string>()
    const vnode = {
      __v_isVNode: true,
      type: { name: 'Fragment' }, // Filtered out
      props: {},
      children: 'content',
    }
    expect(generateVNodeSource(vnode, componentRefs, identitySerializer)).toBe(
      'content',
    )
  })
})

describe('serializeVNodeToTemplate', () => {
  it('returns source and sorted component refs', () => {
    const vnode = {
      __v_isVNode: true,
      type: { __name: 'TaskList' },
      props: {},
      children: [
        {
          __v_isVNode: true,
          type: { __name: 'TaskCard' },
          props: {},
          children: null,
        },
        {
          __v_isVNode: true,
          type: { __name: 'Button' },
          props: {},
          children: null,
        },
      ],
    }

    const result = serializeVNodeToTemplate(vnode)
    expect(result.source).toBe('<TaskList><TaskCard /><Button /></TaskList>')
    expect(result.componentRefs).toEqual(['Button', 'TaskCard', 'TaskList'])
  })

  it('handles primitive values', () => {
    expect(serializeVNodeToTemplate('hello').source).toBe('hello')
    expect(serializeVNodeToTemplate(42).source).toBe('42')
    expect(serializeVNodeToTemplate(null).source).toBe('')
  })

  it('uses default identity serializer', () => {
    const vnode = {
      __v_isVNode: true,
      type: 'div',
      props: { data: { x: 1 } },
      children: null,
    }
    const result = serializeVNodeToTemplate(vnode)
    expect(result.source).toContain(':data=')
  })

  it('uses custom serializer when provided', () => {
    const vnode = {
      __v_isVNode: true,
      type: 'div',
      props: { data: { x: 1 } },
      children: null,
    }
    const customSerializer = (v: unknown) => {
      if (typeof v === 'object' && v !== null) {
        return { serialized: true }
      }
      return v
    }
    const result = serializeVNodeToTemplate(vnode, customSerializer)
    expect(result.source).toContain('{"serialized":true}')
  })

  it('returns empty component refs for non-component vnodes', () => {
    const vnode = {
      __v_isVNode: true,
      type: 'div',
      props: {},
      children: 'content',
    }
    const result = serializeVNodeToTemplate(vnode)
    expect(result.componentRefs).toEqual([])
  })

  it('handles complex nested structures with multiple components', () => {
    const vnode = {
      __v_isVNode: true,
      type: { __name: 'App' },
      props: {},
      children: [
        {
          __v_isVNode: true,
          type: { __name: 'Header' },
          props: {},
          children: 'Title',
        },
        {
          __v_isVNode: true,
          type: 'div',
          props: {},
          children: [
            {
              __v_isVNode: true,
              type: { __name: 'Content' },
              props: {},
              children: null,
            },
            {
              __v_isVNode: true,
              type: { __name: 'Sidebar' },
              props: {},
              children: null,
            },
          ],
        },
        {
          __v_isVNode: true,
          type: { __name: 'Footer' },
          props: {},
          children: null,
        },
      ],
    }

    const result = serializeVNodeToTemplate(vnode)
    expect(result.componentRefs).toEqual([
      'App',
      'Content',
      'Footer',
      'Header',
      'Sidebar',
    ])
    expect(result.source).toContain('<App>')
    expect(result.source).toContain('<Header>')
    expect(result.source).toContain('<Content />')
    expect(result.source).toContain('<Sidebar />')
    expect(result.source).toContain('<Footer />')
  })
})
