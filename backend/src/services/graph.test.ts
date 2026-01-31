import { GraphService } from './validation.service';

describe('GraphService (cycle detection)', () => {
  test('detects no cycle for acyclic graph', () => {
    const tasks = [
      { id: 'a', description: 'A', priority: 'low', dependencies: [] , status: 'pending' },
      { id: 'b', description: 'B', priority: 'low', dependencies: ['a'] , status: 'pending' },
      { id: 'c', description: 'C', priority: 'low', dependencies: ['b'] , status: 'pending' },
    ];

    const res = GraphService.detectCycles(tasks as any);
    expect(res.hasCycle).toBe(false);
    expect(res.cycles).toHaveLength(0);
  });

  test('detects simple cycle and marks error task ids', () => {
    const tasks = [
      { id: 'x', description: 'X', priority: 'low', dependencies: ['y'], status: 'pending' },
      { id: 'y', description: 'Y', priority: 'low', dependencies: ['x'], status: 'pending' },
    ];

    const res = GraphService.detectCycles(tasks as any);
    expect(res.hasCycle).toBe(true);
    // both x and y should be flagged
    expect(res.errorTaskIds).toEqual(expect.arrayContaining(['x', 'y']));
    expect(res.cycles.length).toBeGreaterThan(0);
  });
});
