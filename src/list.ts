import * as DB from './db.js'

export type Next<T> = T & { next: Next<T> | null }
export type List<T> = DB.Entity & { next: Next<T> | null }

/**
 * Takes a list and an items in it and produces assertions that disassociate
 * the item from the list.
 */
export const remove = <T extends DB.Entity>(
  list: List<T>,
  item: T
): DB.Fact[] => {
  let last = list
  let current = last.next
  while (current) {
    if (current === item) {
      return [DB.assert(last, 'next', current.next)]
    } else {
      last = current
      current = current.next
    }
  }
  return []
}

/**
 * Takes head of the list and associates `item` as next item in the list,
 * shifting item that was previously next to the end of the list.
 */
export const insert = <T extends DB.Entity>(
  head: Next<T>,
  item: T
): DB.Fact[] => {
  if (head.next) {
    return [
      DB.assert(head, 'next', item),
      DB.assert(item, 'next', DB.id(head.next)),
    ]
  } else {
    return [DB.assert(head, 'next', item)]
  }
}

export const values = function* values<T extends DB.Entity>(
  list: List<T>
): Iterable<T> {
  let current = list
  while (current.next) {
    yield current.next
    current = current.next
  }
}
