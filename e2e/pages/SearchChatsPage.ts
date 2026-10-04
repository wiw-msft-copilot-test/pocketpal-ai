import {BasePage} from './BasePage';
import {Selectors, byAccessibilityLabelContains} from '../helpers/selectors';

declare const browser: WebdriverIO.Browser;

export class SearchChatsPage extends BasePage {
  async waitForReady(timeout = 10000): Promise<void> {
    await this.waitForElement(Selectors.chatSearch.input, timeout);
  }

  async search(query: string): Promise<void> {
    await this.typeText(Selectors.chatSearch.input, query);
    await browser.pause(350);
  }

  async openResult(titleFragment: string): Promise<void> {
    const result = browser.$(byAccessibilityLabelContains(titleFragment));
    await result.waitForDisplayed({timeout: 15000});
    await result.click();
  }
}
