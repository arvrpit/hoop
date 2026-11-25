// Global undo/redo stack (spec 5.5). Generic over the operation type; the stitch engine knows how
// to apply and revert each operation. A new action clears the redo stack.
export class History<Op> {
  private done: Op[] = [];
  private undone: Op[] = [];

  record(op: Op): void {
    this.done.push(op);
    this.undone.length = 0;
  }

  /** Moves the latest operation to the redo stack and returns it (the caller reverts it). */
  takeUndo(): Op | undefined {
    const op = this.done.pop();
    if (op !== undefined) this.undone.push(op);
    return op;
  }

  /** Moves the latest undone operation back and returns it (the caller re-applies it). */
  takeRedo(): Op | undefined {
    const op = this.undone.pop();
    if (op !== undefined) this.done.push(op);
    return op;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }
  get canRedo(): boolean {
    return this.undone.length > 0;
  }
  get size(): number {
    return this.done.length;
  }

  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }
}
