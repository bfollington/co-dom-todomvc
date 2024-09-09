import * as DB from './db.js'
import * as CoDOM from '@gozala/co-dom'

export type Command =
  | { type: 'Toggle'; at: Model; completed: boolean }
  | { type: 'BeginEdit'; at: Model }
  | { type: 'EndEdit'; at: Model }
  | { type: 'Edit'; at: Model; title: string }
  | { type: 'Ignore' }

export type Model = DB.Entity & {
  next: DB.Entity<Model>
  title: string
  completed: boolean
}

export const query = ({ item }: { item: DB.Term<Model> }): DB.Query<Model> => ({
  select: {
    title: { '?': 'title' },
    completed: { '?': 'completed' },
  },
  where: [
    [item, 'title', { '?': 'title' }],
    [item, 'completed', { '?': 'completed' }],
  ],
})

export const view = (item: Model) =>
  CoDOM.li(
    [
      CoDOM.attribute('class', item.completed ? 'completed' : 'editing'),
      CoDOM.attribute('id', `${DB.id(item)}`),
    ],
    [
      CoDOM.div(
        [CoDOM.attribute('class', 'view')],
        [
          CoDOM.input([
            CoDOM.attribute('type', 'checkbox'),
            CoDOM.attribute('checked', item.completed ? '' : null),
            // Note: We can have a declarative description of what data we want to
            // extract from the event source as opposed to open ended function, but
            // in the meantime we do this.
            CoDOM.on('change', {
              decode(input: InputEvent) {
                return {
                  message: {
                    type: 'Toggle' as const,
                    // at: DB.id(item),
                    at: item,
                    completed: (input.target as HTMLInputElement).checked,
                  },
                }
              },
            }),
          ]),

          CoDOM.label(
            [
              CoDOM.on('dblclick', {
                decode(): { message: Command } {
                  return {
                    message: { type: 'BeginEdit' as const, at: item },
                  }
                },
              }),
            ],
            [CoDOM.text(item.title)]
          ),
        ]
      ),
      CoDOM.input([
        CoDOM.attribute('class', 'edit'),
        CoDOM.attribute('value', item.title),
        CoDOM.on('blur', {
          decode(input: FocusEvent) {
            return {
              message: {
                type: 'EndEdit' as const,
                at: item,
              },
            }
          },
        }),
        CoDOM.on('keydown', {
          decode(input: KeyboardEvent): { message: Command } {
            if (input.key === 'Enter') {
              return {
                message: {
                  type: 'EndEdit' as const,
                  at: item,
                },
              }
            } else {
              return { message: { type: 'Ignore' as const } }
            }
          },
        }),
        CoDOM.on('input', {
          decode(input: InputEvent) {
            return {
              message: {
                type: 'Edit' as const,
                at: item,
                title: (input.target as HTMLInputElement).value,
              },
            }
          },
        }),
      ]),
    ]
  )

export const mutate = (model: Model, command: Command): DB.Fact[] => {
  switch (command.type) {
    case 'Toggle':
      return [[model, 'completed', command.completed]]
    case 'BeginEdit':
      return [[model, 'editing', true]]
    case 'EndEdit':
      return [[model, 'editing', false]]
    case 'Edit':
      return [[model, 'title', command.title]]
    case 'Ignore':
      return []
  }
}
