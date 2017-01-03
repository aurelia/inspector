import {autoinject} from 'aurelia-dependency-injection';
import {bindable} from 'aurelia-templating';
import {TaskQueue} from 'aurelia-task-queue';
import {DebugHost} from '../../backend/debug-host';

@autoinject
export class PropertyView {
  @bindable property;
  editor: HTMLInputElement;
  
  constructor(public debugHost: DebugHost, private taskQueue: TaskQueue) { }

  beginEditing() {
    if (this.property.canEdit) {
      this.property.isEditing = true;
      this.taskQueue.queueMicroTask(() => {
        this.editor.focus();
        this.editor.select();
      });
    }
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.keyCode === 13) {
      this.endEditing();
    }

    return true;
  }

  endEditing() {
    this.property.value = this.editor.value;
    this.property.isEditing = false;
    this.debugHost.updateDebugValue(this.property);
  }
}
