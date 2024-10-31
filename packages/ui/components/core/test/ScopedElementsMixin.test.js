import { expect, fixture } from '@open-wc/testing';
import {
  ssrNonHydratedFixture,
  ssrHydratedFixture,
  csrFixture,
} from '@lit-labs/testing/fixtures.js';
import { LitElement, html } from 'lit';
import sinon from 'sinon';
import { browserDetection } from '../src/browserDetection.js';

import { ScopedElementsMixin, supportsScopedRegistry } from '../src/ScopedElementsMixin.js';

const hasRealScopedRegistrySupport = supportsScopedRegistry();
const originalShadowRootProps = {
  // @ts-expect-error
  createElement: globalThis.ShadowRoot?.prototype.createElement,
  // @ts-expect-error
  importNode: globalThis.ShadowRoot?.prototype.importNode,
};

// Even though the polyfill might be loaded in this test or we run it in a browser supporting these features,
// we mock "no support", so that `supportsScopedRegistry()` returns false inside ScopedElementsMixin..
function mockNoRegistrySupport() {
  // Are we on a server or do we have no polyfill? Nothing to be done here...
  if (!hasRealScopedRegistrySupport) return;

  // This will be enough to make the `supportsScopedRegistry()` check fail inside ScopedElementsMixin and bypass scoped registries
  globalThis.ShadowRoot = globalThis.ShadowRoot || { prototype: {} };
  // @ts-expect-error
  globalThis.ShadowRoot.prototype.createElement = null;
}

mockNoRegistrySupport.restore = () => {
  // Are we on a server or do we have no polyfill? Nothing to be done here...
  if (!hasRealScopedRegistrySupport) return;

  // @ts-expect-error
  globalThis.ShadowRoot.prototype.createElement = originalShadowRootProps.createElement;
  // @ts-expect-error
  globalThis.ShadowRoot.prototype.importNode = originalShadowRootProps.importNode;
};

class ScopedElementsChild extends LitElement {
  render() {
    return html`<span>I'm a child</span>`;
  }
}

class ScopedElementsHost extends ScopedElementsMixin(LitElement) {
  static scopedElements = { 'scoped-elements-child': ScopedElementsChild };

  render() {
    return html`<scoped-elements-child></scoped-elements-child>`;
  }
}
customElements.define('scoped-elements-host', ScopedElementsHost);

describe('ScopedElementsMixin', () => {
  it('renders child elements correctly (that were not registered yet on global registry)', async () => {
    // customElements.define('scoped-elements-child', ScopedElementsChild);
    for (const _fixture of [csrFixture, ssrNonHydratedFixture, ssrHydratedFixture]) {
      const el = await _fixture(html`<scoped-elements-host></scoped-elements-host>`, {
        // we must provide modules atm
        modules: ['./ssr-definitions/ScopedElementsHost.define.js'],
      });

      // Wait for FF support
      if (!browserDetection.isFirefox) {
        expect(
          el.shadowRoot?.querySelector('scoped-elements-child')?.shadowRoot?.innerHTML,
        ).to.contain("<span>I'm a child</span>");
      }

      // @ts-expect-error
      expect(el.registry.get('scoped-elements-child')).to.not.be.undefined;
    }
  });

  describe('When scoped registries are supported', () => {
    it('registers elements on local registry', async () => {
      const ceDefineSpy = sinon.spy(customElements, 'define');

      const el = /** @type {ScopedElementsHost} */ (
        await fixture(html`<scoped-elements-host></scoped-elements-host>`)
      );

      // @ts-expect-error
      expect(el.registry.get('scoped-elements-child')).to.equal(ScopedElementsChild);
      expect(el.registry).to.not.equal(customElements);
      expect(ceDefineSpy.calledWith('scoped-elements-child')).to.be.false;

      ceDefineSpy.restore();
    });
  });

  describe('When scoped registries are not supported', () => {
    class ScopedElementsChildNoReg extends LitElement {
      render() {
        return html`<span>I'm a child</span>`;
      }
    }

    class ScopedElementsHostNoReg extends ScopedElementsMixin(LitElement) {
      static scopedElements = { 'scoped-elements-child-no-reg': ScopedElementsChildNoReg };

      render() {
        return html`<scoped-elements-child-no-reg></scoped-elements-child-no-reg>`;
      }
    }
    before(() => {
      mockNoRegistrySupport();
      customElements.define('scoped-elements-host-no-reg', ScopedElementsHostNoReg);
    });

    after(() => {
      mockNoRegistrySupport.restore();
    });

    it('registers elements', async () => {
      const ceDefineSpy = sinon.spy(customElements, 'define');

      const el = /** @type {ScopedElementsHostNoReg} */ (
        await fixture(html`<scoped-elements-host-no-reg></scoped-elements-host-no-reg>`)
      );

      expect(el.registry).to.equal(customElements);
      expect(ceDefineSpy.calledWith('scoped-elements-child-no-reg')).to.be.true;
      ceDefineSpy.restore();
    });
  });
});