// 홈 할 일(19 H-06) 닫은 목록. 홈(frame/home-input)이 읽고, 다른 화면이 ‘끝냈음’을 남길 때 씀(기기에만).
export const TODO_KEY = 'sweetwo:home:todo-closed';

export const readClosedTodos = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(TODO_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** 할 일을 끝냈음(닫음)으로 남김. 이미 있으면 그대로 */
export function closeHomeTodo(key: string) {
  const list = readClosedTodos();
  if (list.includes(key)) return list;
  const next = [...list.slice(-30), key];
  try {
    localStorage.setItem(TODO_KEY, JSON.stringify(next));
  } catch {
    /* 저장소를 못 쓰면 이번 실행에서만 */
  }
  return next;
}
