import {DebugHost, SelectionChanged} from './backend/debug-host';
import {autoinject} from 'aurelia-dependency-injection';

@autoinject
export class App {
  debugInfo: any;

  constructor(private debugHost: DebugHost) {}

  attached() {
    this.debugHost.attach(this);
  }

  onSelectionChanged(event: SelectionChanged) {
    this.debugInfo = event.debugInfo;
  }
}

export class StringifyValueConverter {
  toView(value) {
    return JSON.stringify(value);
  }
}
