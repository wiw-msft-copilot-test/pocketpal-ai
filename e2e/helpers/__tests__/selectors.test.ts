import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {byInputTestId, Selectors} from '../selectors';
import {readReplyText} from '../element-text';

declare const browser: WebdriverIO.Browser;

const originalDriver = Object.getOwnPropertyDescriptor(globalThis, 'driver');
const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, 'browser');
after(() => {
  if (originalDriver) {
    Object.defineProperty(globalThis, 'driver', originalDriver);
  } else {
    Reflect.deleteProperty(globalThis, 'driver');
  }
  if (originalBrowser) {
    Object.defineProperty(globalThis, 'browser', originalBrowser);
  } else {
    Reflect.deleteProperty(globalThis, 'browser');
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

  it('reads enriched markdown virtual Android paragraphs rather than TextViews', async () => {
    Object.defineProperty(globalThis, 'driver', {
      configurable: true,
      value: {isAndroid: true},
    });
    const texts = ['', '', 'Streaming fixture complete.', 'Second paragraph.'];
    Object.defineProperty(globalThis, 'browser', {
      configurable: true,
      value: {
        $: () => ({
          $$: async (selector: string) => {
            assert.equal(selector, './/*');
            return texts.map(text => ({getText: async () => text}));
          },
        }),
      },
    });
    assert.equal(
      await readReplyText(browser.$(Selectors.chat.aiMessage)),
      'Streaming fixture complete.\nSecond paragraph.',
    );
  });
});
