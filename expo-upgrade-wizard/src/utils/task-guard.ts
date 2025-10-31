/**
 * Task execution guard to prevent duplicate/repetitive task execution
 * Addresses the issue where tasks might be called multiple times
 */
export class TaskGuard {
  private static executedTasks: Set<string> = new Set();
  private static taskStartTimes: Map<string, number> = new Map();

  /**
   * Check if a task should be executed
   * Returns false if task was already executed recently
   */
  static shouldExecute(taskId: string, cooldownMs: number = 1000): boolean {
    const now = Date.now();
    const lastExecution = this.taskStartTimes.get(taskId);

    // If task was executed recently, skip it
    if (lastExecution && now - lastExecution < cooldownMs) {
      console.warn(
        `⚠️  Task "${taskId}" was already executed ${Math.round(
          (now - lastExecution) / 1000
        )}s ago. Skipping duplicate execution.`
      );
      return false;
    }

    return true;
  }

  /**
   * Mark a task as started
   */
  static markStarted(taskId: string): void {
    this.taskStartTimes.set(taskId, Date.now());
    this.executedTasks.add(taskId);
  }

  /**
   * Mark a task as completed
   */
  static markCompleted(taskId: string): void {
    // Keep the start time for cooldown checking
    // but mark as completed
  }

  /**
   * Reset all guards (useful for testing or retry scenarios)
   */
  static reset(): void {
    this.executedTasks.clear();
    this.taskStartTimes.clear();
  }

  /**
   * Get execution statistics
   */
  static getStats(): {
    totalExecuted: number;
    tasks: string[];
  } {
    return {
      totalExecuted: this.executedTasks.size,
      tasks: Array.from(this.executedTasks),
    };
  }
}

/**
 * Decorator to guard a task function from duplicate execution
 */
export function guardTask(taskId: string, cooldownMs: number = 1000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!TaskGuard.shouldExecute(taskId, cooldownMs)) {
        return; // Skip execution
      }

      TaskGuard.markStarted(taskId);
      try {
        const result = await originalMethod.apply(this, args);
        TaskGuard.markCompleted(taskId);
        return result;
      } catch (error) {
        TaskGuard.markCompleted(taskId);
        throw error;
      }
    };

    return descriptor;
  };
}
