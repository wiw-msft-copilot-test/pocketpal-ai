import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {byInputTestId, Selectors} from '../selectors';

const originalDriver = Object.getOwnPropertyDescriptor(globalThis, 'driver');
after(() => {
  if (originalDriver) {
    Object.defineProperty(globalThis, 'driver', originalDriver);
  } else {
    Reflect.deleteProperty(globalThis, 'driver');
  }
});

describe('remote input selectors', () => {
  it('targets Android editors instead of Paper labels sharing their ID prefix', () => {
    Object.defineProperty(globalThis, 'driver', {
      configurable: true,
      value: {isAndroid: true},
    });
    assert.equal(
      byInputTestId('remote-url-input'),
      '//android.widget.EditText[contains(@resource-id, "remote-url-input")]',
    );
    for (const selector of [
      Selectors.remoteModel.urlInput,
      Selectors.remoteModel.nameInput,
      Selectors.remoteModel.apiKeyInput,
      Selectors.remoteModel.timeoutInput,
      Selectors.serverDetails.urlInput,
      Selectors.serverDetails.apiKeyInput,
      Selectors.serverDetails.timeoutInput,
    ]) {
      assert.match(selector, /^\/\/android\.widget\.EditText\[/);
    }
  });

  it('retains the iOS accessibility identifier strategy', () => {
    Object.defineProperty(globalThis, 'driver', {
      configurable: true,
      value: {isAndroid: false},
    });
    assert.equal(Selectors.remoteModel.urlInput, '~remote-url-input');
    assert.equal(Selectors.remoteModel.nameInput, '~remote-name-input');
    assert.equal(Selectors.remoteModel.apiKeyInput, '~remote-apikey-input');
    assert.equal(Selectors.remoteModel.timeoutInput, '~remote-timeout-input');
    assert.equal(Selectors.serverDetails.urlInput, '~server-details-url-input');
    assert.equal(
      Selectors.serverDetails.apiKeyInput,
      '~server-details-apikey-input',
    );
    assert.equal(
      Selectors.serverDetails.timeoutInput,
      '~server-details-timeout-input',
    );
  });
});
