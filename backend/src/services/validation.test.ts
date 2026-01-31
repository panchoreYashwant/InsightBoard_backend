import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  test('validates schema and returns sanitized tasks', () => {
    const input = [
      { id: 'task-1', description: 'Do thing A', priority: 'high', dependencies: [] },
      { id: 'task-2', description: 'Do thing B', priority: 'medium', dependencies: ['task-1'] },
    ];

    const { validated, invalidDependenciesRemoved } = ValidationService.validateTasks(input as any);
    expect(validated).toHaveLength(2);
    expect(invalidDependenciesRemoved).toBe(0);
    expect(validated[1].dependencies).toEqual(['task-1']);
  });

  test('removes invalid dependencies that reference non-existent tasks', () => {
    const input = [
      { id: 'task-1', description: 'Do A', priority: 'low', dependencies: [] },
      { id: 'task-2', description: 'Do B', priority: 'low', dependencies: ['task-unknown'] },
    ];

    const { validated, invalidDependenciesRemoved } = ValidationService.validateTasks(input as any);
    expect(validated).toHaveLength(2);
    expect(invalidDependenciesRemoved).toBe(1);
    expect(validated[1].dependencies).toEqual([]);
  });

  test('throws on duplicate task IDs', () => {
    const input = [
      { id: 'task-1', description: 'Do A', priority: 'low', dependencies: [] },
      { id: 'task-1', description: 'Duplicate', priority: 'low', dependencies: [] },
    ];

    expect(() => ValidationService.validateTasks(input as any)).toThrow(/duplicate task IDs/i);
  });
});
