export declare const Marker: unique symbol

/**
 * A utility type to retain an unused type parameter `T`.
 * Similar to [phantom type parameters in Rust](https://doc.rust-lang.org/rust-by-example/generics/phantom.html).
 *
 * Capturing unused type parameters allows us to define "nominal types," which
 * TypeScript does not natively support. Nominal types in turn allow us to capture
 * semantics not represented in the actual type structure, without requiring us to define
 * new classes or pay additional runtime costs.
 *
 * For a concrete example, see {@link ByteView}, which extends the `Uint8Array` type to capture
 * type information about the structure of the data encoded into the array.
 */
export interface Phantom<T> {
  // This field can not be represented because field name is non-existent
  // unique symbol. But given that field is optional any object will valid
  // type constraint.
  [Marker]?: T
}

/**
 * Evaluates query and returns a result.
 */
export declare function execute<T>(
  query: Query<T>
): Promise<{ ok: T; error?: void } | { error: Error; ok?: void }>

export declare function id(entity: Entity): bigint

export declare function create(): Entity

export declare function assert(
  entity: Entity,
  attribute: string,
  value: Scalar
): Fact

export declare function retract(
  entity: Entity,
  attribute: string,
  value: Scalar
): object[]

type bytes = Uint8Array
type Scalar = null | boolean | number | bigint | string | bytes | Entity

export type Fact = [entity: Entity, attribute: string, value: Scalar]

/**
 * Variable is placeholder for a value that will be matched against by the
 * query engine.
 */
export type Variable<T = Scalar> = Phantom<T> & {
  '?': string
}

/**
 * Term is either a constant or a {@link Variable}. Terms are used to describe
 * predicates of the query.
 */
export type Term<T = Scalar> = Variable<T> | Scalar

export type Pattern = [
  entity: Term<any>,
  attribute: Term<string>,
  value: Term<Scalar>,
]

export type Query<T> = Phantom<T> & { select: object; where: Pattern[] }

// Just an opaque identifier for the entity in the db.
export type Entity<T = unknown> = Phantom<T> & { '@': bigint }
