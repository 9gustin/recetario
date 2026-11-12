import { useReducer } from "react";

/** Pantallas: [mise en place, ...pasos, final]. */
export type CookingState = {
  index: number;
  total: number;
  completed: Set<number>;
  servings: number;
  /** Dirección de la última navegación (para la animación). */
  direction: 1 | -1;
};

export type CookingAction =
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GOTO"; index: number }
  | { type: "COMPLETE" }
  | { type: "SET_SERVINGS"; servings: number };

export function initCookingState(opts: {
  steps: number;
  servings: number;
  index?: number;
  completed?: number[];
}): CookingState {
  const total = opts.steps + 2;
  return {
    index: Math.min(Math.max(opts.index ?? 0, 0), total - 1),
    total,
    completed: new Set(opts.completed ?? []),
    servings: opts.servings,
    direction: 1,
  };
}

export function cookingReducer(state: CookingState, action: CookingAction): CookingState {
  switch (action.type) {
    case "NEXT":
      return state.index >= state.total - 1
        ? state
        : { ...state, index: state.index + 1, direction: 1 };
    case "PREV":
      return state.index <= 0 ? state : { ...state, index: state.index - 1, direction: -1 };
    case "GOTO": {
      const index = Math.min(Math.max(action.index, 0), state.total - 1);
      return index === state.index
        ? state
        : { ...state, index, direction: index > state.index ? 1 : -1 };
    }
    case "COMPLETE": {
      if (state.completed.has(state.index)) return state;
      return { ...state, completed: new Set(state.completed).add(state.index) };
    }
    case "SET_SERVINGS":
      return action.servings > 0 ? { ...state, servings: action.servings } : state;
  }
}

export function useCookingReducer(init: Parameters<typeof initCookingState>[0]) {
  return useReducer(cookingReducer, init, initCookingState);
}
