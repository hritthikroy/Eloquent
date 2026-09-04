// Minimal type definitions for React in the renderer environment
declare namespace React {
  export type ReactNode = string | number | boolean | null | undefined | ReactElement<any, any> | ReactNodeArray;
  export interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: string | number | null;
  }
  export type JSXElementConstructor<P> = (props: P) => ReactElement<any, any> | null;
  export interface ReactNodeArray extends Array<ReactNode> {}
  
  export type FC<P = {}> = (props: P) => ReactElement<any, any> | null;
  
  export interface CSSProperties {
    [key: string]: any;
  }

  export interface RefObject<T> {
    readonly current: T | null;
  }

  export interface MutableRefObject<T> {
    current: T;
  }

  export interface ChangeEvent<T = Element> {
    target: T & { value: string };
  }

  export interface KeyboardEvent<T = Element> {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    target: T;
    preventDefault: () => void;
  }

  export interface FormEvent<T = Element> {
    preventDefault: () => void;
  }

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;
}

declare module 'react' {
  export = React;
}

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
