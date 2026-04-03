export type HistoryAction = {
  label: string;
  undo: () => void;
  redo: () => void;
};

export class History {
  private actions: HistoryAction[] = [];
  private cursor = -1;

  constructor(private onChange?: () => void) {}

  push(action: HistoryAction) {
    this.actions = this.actions.slice(0, this.cursor + 1);
    this.actions.push(action);
    this.cursor = this.actions.length - 1;
    this.onChange?.();
  }

  undo() {
    if (!this.canUndo()) {
      return false;
    }

    const action = this.actions[this.cursor];
    action?.undo();
    this.cursor -= 1;
    this.onChange?.();
    return true;
  }

  redo() {
    if (!this.canRedo()) {
      return false;
    }

    this.cursor += 1;
    const action = this.actions[this.cursor];
    action?.redo();
    this.onChange?.();
    return true;
  }

  canUndo() {
    return this.cursor >= 0;
  }

  canRedo() {
    return this.cursor < this.actions.length - 1;
  }

  getEntries() {
    return [...this.actions];
  }
}
