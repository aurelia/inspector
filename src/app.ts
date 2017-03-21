import {DebugHost, SelectionChanged} from './backend/debug-host';
import {autoinject} from 'aurelia-dependency-injection';

@autoinject
export class App {
  debugInfo: any;
  isDarkTheme: boolean = false;

  constructor(private debugHost: DebugHost) {}

  attached() {
    this.debugHost.attach(this);
    this.isDarkTheme = chrome && chrome.devtools && chrome.devtools.panels && (<any>chrome.devtools.panels).themeName === 'dark';
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
