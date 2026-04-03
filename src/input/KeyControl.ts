type KeyControlCallbacks = {
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
};

export class KeyControl {
  private spacePressed = false;

  constructor(private callbacks: KeyControlCallbacks) {}

  attach() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
  }

  isPanningModifierActive() {
    return this.spacePressed;
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Space") {
      this.spacePressed = true;
      event.preventDefault();
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      this.callbacks.deleteSelection();
      return;
    }

    const hasCommandModifier = event.metaKey || event.ctrlKey;

    if (!hasCommandModifier) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        this.callbacks.redo();
      } else {
        this.callbacks.undo();
      }

      return;
    }

    if (key === "y") {
      event.preventDefault();
      this.callbacks.redo();
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Space") {
      this.spacePressed = false;
    }
  };

  private handleBlur = () => {
    this.spacePressed = false;
  };
}
