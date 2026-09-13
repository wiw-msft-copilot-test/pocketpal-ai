import {expect} from '@wdio/globals';
import {ChatPage} from '../../pages/ChatPage';
import {DrawerPage} from '../../pages/DrawerPage';
import {ModelsPage} from '../../pages/ModelsPage';
import {PalSheetPage} from '../../pages/PalSheetPage';
import {TIMEOUTS} from '../../fixtures/models';
import {
  CHAT_MODEL_ID,
  RESPONSES_MODEL_ID,
  UNSUPPORTED_MODEL_ID,
} from '../../fixtures/remote-responses-server';
import {Selectors, byPartialText} from '../../helpers/selectors';
import {Gestures} from '../../helpers/gestures';
import {saveFailureScreenshot} from '../../helpers/screenshots';
import {
  addModelFromOpenRemoteSheet,
  fixtureStatus,
  latestAssistantText,
  resetFixture,
  selectChatModel,
  waitForAssistantText,
} from '../../helpers/remote-responses';

declare const browser: WebdriverIO.Browser;
declare const driver: WebdriverIO.Browser;

const FIXTURE_URL =
  process.env.E2E_REMOTE_FIXTURE_URL || 'http://127.0.0.1:18080';
const APP_ID = 'com.pocketpalai.e2e';
const PAL_NAME = 'E2E Calculate';

async function navigateToModels(
  chatPage: ChatPage,
  drawerPage: DrawerPage,
  modelsPage: ModelsPage,
): Promise<void> {
  await chatPage.openDrawer();
  await drawerPage.waitForOpen();
  await drawerPage.navigateToModels();
  await modelsPage.waitForReady();
}

async function waitForConnected(): Promise<void> {
  await browser
    .$(byPartialText('Connected'))
    .waitForDisplayed({timeout: 15000});
}

async function assertLatestPath(path: string): Promise<void> {
  const status = await fixtureStatus(FIXTURE_URL);
  const request = status.requests.at(-1);
  expect(request?.method).toBe('POST');
  expect(request?.path).toBe(path);
  expect(request?.headers.authorization).toBeUndefined();
  expect(request?.authorizationPresent).toBe(false);
  expect(request?.headers['copilot-integration-id']).toBe(
    'copilot-developer-cli-test',
  );
}

describe('Remote Responses protocol', () => {
  let chatPage: ChatPage;
  let drawerPage: DrawerPage;
  let modelsPage: ModelsPage;

  before(async () => {
    await fixtureStatus(FIXTURE_URL);
    await resetFixture(FIXTURE_URL);
    chatPage = new ChatPage();
    drawerPage = new DrawerPage();
    modelsPage = new ModelsPage();
    await chatPage.waitForReady(TIMEOUTS.appReady);
  });

  beforeEach(() => {
    chatPage = new ChatPage();
    drawerPage = new DrawerPage();
    modelsPage = new ModelsPage();
  });

  afterEach(async function (this: Mocha.Context) {
    if (this.currentTest?.state === 'failed') {
      await saveFailureScreenshot(this.currentTest.title);
    }
  });

  it('adds a Copilot Auto server and routes a Responses-only model', async () => {
    await navigateToModels(chatPage, drawerPage, modelsPage);
    await modelsPage.openAddRemoteModel();

    await browser.$(Selectors.serverType.dropdown()).click();
    await browser
      .$(Selectors.serverType.option('GitHub Copilot'))
      .waitForDisplayed({timeout: 5000});
    await browser.$(Selectors.serverType.option('GitHub Copilot')).click();

    const protocolDropdown = browser.$(Selectors.remoteModel.protocolDropdown);
    const protocolValue =
      (await protocolDropdown.getAttribute('content-desc').catch(() => '')) ||
      (await protocolDropdown.getText().catch(() => ''));
    expect(protocolValue).toContain('Auto');

    const urlInput = browser.$(Selectors.remoteModel.urlInput);
    await urlInput.setValue(FIXTURE_URL);
    await modelsPage.hideKeyboard();
    await waitForConnected();

    await Gestures.scrollInSheetToElementExists(
      Selectors.remoteModel.protocolRow(RESPONSES_MODEL_ID),
      10,
    );
    const responseProtocol = await browser
      .$(Selectors.remoteModel.protocolRow(RESPONSES_MODEL_ID))
      .getText();
    expect(responseProtocol).toContain('Responses');
    expect(responseProtocol).toContain('catalog');

    await Gestures.scrollInSheetToElementExists(
      Selectors.remoteModel.protocolRow(UNSUPPORTED_MODEL_ID),
      10,
    );
    const unsupportedProtocol = await browser
      .$(Selectors.remoteModel.protocolRow(UNSUPPORTED_MODEL_ID))
      .getText();
    expect(unsupportedProtocol).toContain('Unsupported');

    await addModelFromOpenRemoteSheet(RESPONSES_MODEL_ID);
    await modelsPage.waitForReady();

    await chatPage.openDrawer();
    await drawerPage.waitForOpen();
    await drawerPage.navigateToChat();
    await selectChatModel(RESPONSES_MODEL_ID);
    await chatPage.sendMessage('fixture:incremental');
    await waitForAssistantText('Streaming ');
    expect(
      await browser
        .$(Selectors.chat.stopButton)
        .isDisplayed()
        .catch(() => false),
    ).toBe(true);
    await waitForAssistantText('Streaming fixture complete.');
    await browser
      .$(Selectors.chat.stopButton)
      .waitForDisplayed({reverse: true, timeout: 10000});
    await assertLatestPath('/responses');
  });

  it('persists Responses history across relaunch and continues it', async () => {
    await driver.terminateApp(APP_ID);
    await browser.pause(800);
    await driver.activateApp(APP_ID);
    await chatPage.waitForReady(TIMEOUTS.appReady);
    await chatPage.openDrawer();
    await drawerPage.waitForOpen();
    await drawerPage.tapSession('fixture:incremental');
    expect(await latestAssistantText()).toContain(
      'Streaming fixture complete.',
    );

    await selectChatModel(RESPONSES_MODEL_ID);
    await chatPage.sendMessage('fixture:final-only');
    await waitForAssistantText('Final-only fixture output.');
    const status = await fixtureStatus(FIXTURE_URL);
    const request = status.requests.at(-1);
    expect(request?.path).toBe('/responses');
    expect(JSON.stringify(request?.body)).toContain(
      'Streaming fixture complete.',
    );
  });

  it('surfaces reasoning and cancels an in-flight Responses stream', async () => {
    await chatPage.sendMessage('fixture:reasoning');
    expect(await chatPage.isThinkingBubbleVisible(15000)).toBe(true);
    await waitForAssistantText('Reasoning fixture answer.');

    await chatPage.sendMessage('fixture:slow');
    await waitForAssistantText('Slow fixture started.');
    const stop = browser.$(Selectors.chat.stopButton);
    await stop.waitForDisplayed({timeout: 5000});
    await stop.click();
    await stop.waitForDisplayed({reverse: true, timeout: 10000});
    await browser.waitUntil(
      async () => {
        const status = await fixtureStatus(FIXTURE_URL);
        return status.requests.some(
          request => request.scenario === 'slow' && request.aborted,
        );
      },
      {timeout: 10000, interval: 300},
    );
  });

  it('surfaces incomplete, refusal, and failure outcomes', async () => {
    await chatPage.sendMessage('fixture:incomplete');
    await waitForAssistantText('Partial fixture output.');

    await chatPage.sendMessage('fixture:refusal');
    await waitForAssistantText('Synthetic fixture refusal.');

    await chatPage.sendMessage('fixture:failure');
    await waitForAssistantText('Completion failed');
  });

  it('runs the built-in calculate talent and validates exact replay', async () => {
    await chatPage.openPalPicker();
    await chatPage.selectPal('Lookie');
    await chatPage.openPalPicker();
    const lookie = browser.$(byPartialText('Lookie'));
    for (let attempt = 0; attempt < 3; attempt++) {
      await Gestures.swipe({
        startXPercent: 0.2,
        startYPercent: 0.7,
        endXPercent: 0.8,
        endYPercent: 0.7,
        duration: 300,
      });
      if (
        await lookie
          .waitForDisplayed({timeout: 3000})
          .then(() => true)
          .catch(() => false)
      ) {
        break;
      }
    }
    await lookie.waitForDisplayed({timeout: 5000});
    const settings = browser.$(Selectors.chat.palPicker.settings('Lookie'));
    await settings.waitForDisplayed({timeout: 5000});
    await settings.click();
    const palSheet = new PalSheetPage();
    await palSheet.setName(PAL_NAME);
    await palSheet.setSystemPrompt(
      'Use the calculate talent whenever the user requests arithmetic.',
    );
    await palSheet.enableTalent('calculate');
    await palSheet.submit();

    await chatPage.waitForReady(TIMEOUTS.appReady);
    await chatPage.sendMessage('fixture:tool calculate 6*7');
    await waitForAssistantText('Tool replay validated: 6*7 = 42.', 45000);
    const status = await fixtureStatus(FIXTURE_URL);
    expect(status.toolReplayValidated).toBe(true);
  });

  it('adds and routes the Chat-only model through chat completions', async () => {
    await navigateToModels(chatPage, drawerPage, modelsPage);
    await modelsPage.openAddRemoteModel();
    const knownServer = browser.$(byPartialText('127.0.0.1'));
    await knownServer.waitForDisplayed({timeout: 5000});
    await knownServer.click();
    await waitForConnected();

    await Gestures.scrollInSheetToElementExists(
      Selectors.remoteModel.protocolRow(CHAT_MODEL_ID),
      10,
    );
    expect(
      await browser
        .$(Selectors.remoteModel.protocolRow(CHAT_MODEL_ID))
        .getText(),
    ).toContain('Chat Completions');
    await addModelFromOpenRemoteSheet(CHAT_MODEL_ID);

    await chatPage.openDrawer();
    await drawerPage.waitForOpen();
    await drawerPage.navigateToChat();
    await selectChatModel(CHAT_MODEL_ID);
    await chatPage.sendMessage('verify chat routing');
    await waitForAssistantText('Chat completions route confirmed.');
    await assertLatestPath('/chat/completions');
  });
});
