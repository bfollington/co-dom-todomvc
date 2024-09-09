import * as CoDOM from '@gozala/co-dom'
import * as DB from './db.js'
import * as Todo from './todo.js'

export type List<Item extends { next: DB.Entity<Item> }> = Item[]

export type Visibility = 'All' | 'Active' | 'Completed'

/**
 * Describes data model of this (todo list) recipe.
 */
export type Model = DB.Entity & {
  entries: List<Todo.Model>
  visibility: Visibility
  input: string
}

/**
 * Describes query for pulling all the relevant data associated with this
 * recipe. It takes `term` that for the entity that this gem will interact with.
 */
export const query = ({ todo }: { todo: DB.Term<Model> }): DB.Query<Model> => ({
  select: {
    input: { '?': 'input' },
    visibility: { '?': 'visibility' },
    entries: {
      next: { '?': 'list/next' },
      // select all the things pulled from the todo query
      ...Todo.query({ item: { '?': 'next' } }).select,
    },
  },
  where: [
    [todo, '.[]', { '?': 'item' }],
    [todo, 'input', { '?': 'input' }],
    [todo, 'visibility', { '?': 'visibility' }],
    ['item', 'next', { '?': 'next' }],
    ...Todo.query({ item: { '?': 'item ' } }).where,
  ],
})

/**
 * Generates VDOM from the data model of this recipe. Note that VDOM has output
 * port where all the commands triggered by user events will be sent.
 */
export const view = ({ entries, input, visibility }: Model) =>
  CoDOM.div(
    [CoDOM.attribute('class', 'todomvc-wrapper')],
    [
      CoDOM.section(
        [CoDOM.attribute('class', 'todoapp')],
        [
          viewInput(input),
          viewEntries(entries, visibility),
          viewControls(entries, visibility),
        ]
      ),
      viewFooter(),
    ]
  )

export const viewInput = (input: string) =>
  CoDOM.section(
    [CoDOM.attribute('class', 'header')],
    [
      CoDOM.h1([], [CoDOM.text('todos')]),
      CoDOM.input([
        CoDOM.attribute('class', 'new-todo'),
        CoDOM.attribute('placeholder', 'What needs to be done?'),
        CoDOM.attribute('autofocus', ''),
        CoDOM.attribute('value', input),
        CoDOM.attribute('name', 'newTodo'),
        CoDOM.on('input', {
          decode(input: InputEvent) {
            return {
              message: {
                type: 'EditInput' as const,
                title: (input.target as HTMLInputElement).value,
              },
            }
          },
        }),
        CoDOM.on('keydown', {
          decode(input: KeyboardEvent): CoDOM.DecodedEvent<Command> {
            if (input.key === 'Enter') {
              return {
                message: {
                  type: 'Enter' as const,
                  title: (input.target as HTMLInputElement).value,
                },
              }
            } else {
              return { message: { type: 'Ignore' as const } }
            }
          },
        }),
      ]),
    ]
  )

const isVisible = (visibility: Visibility, entry: Todo.Model) =>
  visibility === 'All'
    ? true
    : visibility === 'Active'
      ? !entry.completed
      : entry.completed

export const viewEntries = (
  entries: List<Todo.Model>,
  visibility: Visibility
) =>
  CoDOM.section(
    [
      CoDOM.attribute('class', 'main'),
      CoDOM.attribute(
        'visibility',
        entries.length === 0 ? 'hidden' : 'visible'
      ),
    ],
    [
      ...entries.map((entry) =>
        Todo.view(entry).map((command) => ({
          type: 'Route' as const,
          at: entry,
          command,
        }))
      ),
    ]
  )

export const viewControls = (
  entries: List<Todo.Model>,
  visibility: Visibility
) =>
  CoDOM.footer(
    [
      CoDOM.attribute('class', 'footer'),
      CoDOM.attribute('hidden', entries.length === 0 ? '' : null),
    ],
    [
      viewControlsCount(entries.filter((entry) => !entry.completed)),
      viewControlsFilters(visibility),
      viewControlsClear(
        entries.length - entries.filter((entry) => entry.completed).length
      ),
    ]
  )

const viewControlsCount = (entries: List<Todo.Model>) =>
  CoDOM.span(
    [CoDOM.attribute('class', 'todo-count')],
    [
      CoDOM.strong([], [CoDOM.text(entries.length.toString())]),
      CoDOM.text(entries.length === 1 ? ' item left' : 'items left'),
    ]
  )

const viewControlsFilters = (visibility: Visibility) =>
  CoDOM.ul(
    [CoDOM.attribute('class', 'filters')],
    [
      viewControlsFilter('All', visibility),
      viewControlsFilter('Active', visibility),
      viewControlsFilter('Completed', visibility),
    ]
  )

const viewControlsFilter = (visibility: Visibility, actual: Visibility) =>
  CoDOM.li(
    [
      CoDOM.on('click', {
        decode() {
          return { message: { type: 'ChangeVisibility' as const, visibility } }
        },
      }),
    ],
    [
      CoDOM.a(
        [CoDOM.attribute('class', visibility === actual ? 'selected' : '')],
        [CoDOM.text(visibility)]
      ),
    ]
  )

const viewControlsClear = (completed: number) =>
  CoDOM.button(
    [
      CoDOM.attribute('class', 'clear-completed'),
      CoDOM.attribute('hidden', completed === 0 ? '' : null),
      CoDOM.on('click', {
        decode() {
          return { message: { type: 'DeleteCompleted' as const } as Command }
        },
      }),
    ],
    [CoDOM.text(`Clear completed (${completed})`)]
  )

export const viewFooter = () =>
  CoDOM.footer(
    [CoDOM.attribute('class', 'footer')],
    [
      CoDOM.p([], [CoDOM.text('Double-click to edit todo')]),
      CoDOM.p(
        [],
        [
          CoDOM.text('Written by '),
          CoDOM.a(
            [CoDOM.attribute('href', 'https://gozala.io/work')],
            [CoDOM.text('Irakli Gozalishvili')]
          ),
        ]
      ),
      CoDOM.p(
        [],
        [
          CoDOM.text('Part of '),
          CoDOM.a(
            [CoDOM.attribute('href', 'http://todomvc.com')],
            [CoDOM.text('TodoMVC')]
          ),
        ]
      ),
    ]
  )

/**
 * In this case all the todo item commands are received as is without wrapping
 * them in a routing information.
 */
export type Command =
  | { type: 'Route'; at: DB.Entity; command: Todo.Command }
  | { type: 'DeleteCompleted' }
  | { type: 'ChangeVisibility'; visibility: Visibility }
  | { type: 'EditInput'; title: string }
  | { type: 'Enter'; title: string }
  | { type: 'Ignore' }

const last = <T extends { next?: {} | null }>(items: T[]) =>
  items.find((item) => item.next == null) as T

/**
 * Whenever a command is received, we get current model along with a command and
 * return list of assertions produced by the command. Note that we can only make
 * assertions about entities we we received from the query or assertions about
 * new entities we've generated (think of it like local state).
 */
export const mutate = (model: Model, command: Command): DB.Fact[] => {
  switch (command.type) {
    case 'Enter': {
      const entry = DB.create()

      return [
        [model, 'input', ''],
        [entry, 'title', command.title],
        [entry, 'completed', false],
        [last(model.entries), 'next', entry],
      ]
    }
    case 'EditInput': {
      return [[model, 'input', command.title]]
    }
    case 'DeleteCompleted': {
      return remove(
        model.entries,
        model.entries.filter((entry) => entry.completed)
      )
    }
    case 'ChangeVisibility': {
      return [[model, 'visibility', command.visibility]]
    }
    case 'Route': {
      const entry = model.entries.find(
        (entry) => DB.id(entry) === DB.id(command.at)
      )
      return entry ? Todo.mutate(entry, command.command) : []
    }
    default:
      return []
  }
}

const remove = (all: Model['entries'], exclude: Todo.Model[]) => []
