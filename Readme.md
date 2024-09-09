# Todo MVC example with datalogia

Exploration of what classical [Todo MVC] would look like with datalog and virtual DOM. It uses [datalogia] for query system and [co-dom] as virtual DOM abstraction.

## Status

Currently this is just an exploratory sketch, that have not even been executed and may not work if you try. Intention is to produce a working example, but only after it feels right.

## Architecture Overview

Architecture is very similar to Elm's, in which logical components is a module with `init, update, view`. Here instead we have modules with `query, mutate, view` functions.

### `query`

Query functions define a database query that project data from (datomic style) database into desired data model.

```ts
import * as Todo './todo.js'
import * as DB from 'datalogia'
export type Visibility = 'All' | 'Active' | 'Completed'

/**
 * Describes data model of this (todo list) recipe.
 */
export type Model = DB.Entity & {
  entries: Todo.Model[]
  visibility: Visibility
  input: string
}

const input = DB.varibale()
const visibility = DB.varibale()
const item = DB.variable()

export const query = ({ todo }: { todo: DB.Term<Model> }):DB.Query<Model> => ({
  select: {
    input,
    visibility,
    entries: { item }
  },
  where: [
    [todo, 'item', item],
    [todo, 'visibility', visibility],
    [todo, 'input', input],
    // Just like in Elm we don't need to know what exactly data model looks like
    // we compose by delegating.
    ...Todo.query({ item }).where
  ]
})
```

### `mutate`

Mutate function is roughly equivalent of the `update` function in Elm, however unlike producing new models it produces set of DB assertions which when applied will produce new state

> 🤔 I have definitely written code where `update` uses new state before it's returned in order compute something, which makes me wonder if not having a computed (new) state would prove problematic.

```ts
export type Command =
  // Route command to corresponding todo item
  | { type: 'Command'; at: DB.Entity; command: Todo.Command }
  // Deletes all completed tasks
  | { type: 'DeleteCompleted' }
  // Updates visibility
  | { type: 'ChangeVisibility'; visibility: Visibility }
  // Updates input field
  | { type: 'EditInput'; title: string }
  // Adds new input item
  | { type: 'AddItem'; title: string }

export const mutate = (model: Model, command: Command): DB.Transaction => {
  switch (command.type) {
    case 'AddItem': {
      const entry = DB.create()

      return [
        DB.assert([model, 'input', '']), // clear input field
        DB.assert([model, 'item', entry]) // add entry to the todo list
        // Initialize all the attributes by delegating to Todo
        ...Todo.init(entry, { title: command.title })
      ]
    }
    case 'EditInput': {
      return [DB.assert([model, 'input', command.title])]
    }
    case 'DeleteCompleted': {
      return model.entries
        .filter((entry) => entry.completed)
        .map(item => DB.retract(model, 'item', item))
    }
    case 'ChangeVisibility': {
      return [DB.assert([model, 'visibility', command.visibility])]
    }
    case 'Command': {
      const entry = model.entries.find((entry) => DB.id(entry) === command.at)
      return entry ? Todo.mutate(entry, command.command) : []
    }
    default:
      return []
  }
}
```

### `view`

View is simply a VDOM that derives virtual DOM from the data model, providing mapping from user events to commands that are fed back to the `mutate` function.

```js
export const view = ({ entries, input, visibility }: Model):CoDOM.Node<Command> =>
  codom.div(
    [codom.attribute('class', 'todomvc-wrapper')],
    [
      codom.section(
        [codom.attribute('class', 'todoapp')],
        [
          viewInput(input),
          codom.section(
            [
              codom.attribute('class', 'main'),
              codom.attribute('visibility', entries.length === 0 ? 'hidden' : 'visible')
            ],
            [
              ...entries.map((entry) =>
                Todo.view(entry).map((command) => ({
                  type: 'Command' as const,
                  at: DB.id(entry),
                  command,
                }))
              ),
            ]
          )
          viewEntries(entries, visibility),
          viewControls(entries, visibility),
        ]
      ),
      viewFooter(),
    ]
  )
```

## Prior Art

- [Elm Architecture](https://guide.elm-lang.org/architecture/) had been my primary influence and inspiration. I think Elm got abstractions right, it is both simple yet powerful. All the JS libraries that followed seem to fail in one or the other.

  Perhaps the only drawback of Elm's approach is that it leads to a data model which imposes certain hierarchy. This implies rigid data schema and migrations that are source of complexity especially if you want code to be forked and evolved yet be compatible with origin.

  This is where [datalog] seems to have some promise and a goal of this exploration.

- [Datalog UI](https://datalogui.dev/) seems to explore this exact direction, better yet it seems to implement differential variant with query subscriptions.

  Subjectively, main drawback is that it has very opinionated interface that exploits JS proxies and other interesting techniques for query definitions. This made it difficult to explore ideas I wanted to explore here (I also found implementation difficult to follow)

- [Om](https://github.com/omcljs/om) was (to my knowledge) pioneer, exploring idea of driving components from database query. In comparison to Elm however, it's abstractions seemed a lot more complicated so it never appealed to me. Yet here I am exploring essentially same idea a decade later.

[datalogia]:https://github.com/Gozala/datalogia
[co-dom]:https://github.com/Gozala/co-dom
[Todo MVC]:https://todomvc.com/
