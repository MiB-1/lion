import { html, css, render } from 'lit';
import { formatNumber, LocalizeMixin, parseNumber } from '@lion/ui/localize-no-side-effects.js';
import { LionInput } from '@lion/ui/input.js';
import { IsNumber, MinNumber, MaxNumber } from '@lion/ui/form-core.js';
import { localizeNamespaceLoader } from './localizeNamespaceLoader.js';

/**
 * @typedef {import('lit').RenderOptions} RenderOptions
 */

/**
 * `LionInputStepper` is a class for custom input-stepper element (`<lion-input-stepper>` web component).
 *
 * @customElement lion-input-stepper
 */
export class LionInputStepper extends LocalizeMixin(LionInput) {
  static get styles() {
    return [
      ...super.styles,
      css`
        .input-group__container > .input-group__input ::slotted(.form-control) {
          text-align: center;
        }

        .input-stepper__value {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(100%);
          clip: rect(1px, 1px, 1px, 1px);
          white-space: nowrap;
          border: 0;
          margin: 0;
          padding: 0;
        }
      `,
    ];
  }

  /** @type {any} */
  static get properties() {
    return {
      min: {
        type: Number,
        reflect: true,
      },
      max: {
        type: Number,
        reflect: true,
      },
      valueTextMapping: {
        type: Object,
      },
      step: {
        type: Number,
        reflect: true,
      },
    };
  }

  static localizeNamespaces = [
    { 'lion-input-stepper': localizeNamespaceLoader },
    ...super.localizeNamespaces,
  ];

  /**
   * @returns {number}
   */
  get currentValue() {
    return this.modelValue || 0;
  }

  get _inputNode() {
    return /** @type {HTMLInputElement} */ (super._inputNode);
  }

  constructor() {
    super();
    /** @param {string} modelValue */
    this.parser = parseNumber;
    this.formatter = formatNumber;
    this.min = Infinity;
    this.max = Infinity;
    /**
     * The aria-valuetext attribute defines the human-readable text alternative of aria-valuenow.
     * @type {{[key: number]: string}}
     */
    this.valueTextMapping = {};
    this.step = 1;
    this.values = {
      max: this.max,
      min: this.min,
      step: this.step,
    };

    this.__increment = this.__increment.bind(this);
    this.__decrement = this.__decrement.bind(this);
    this._onEnterButton = this._onEnterButton.bind(this);
    this._onLeaveButton = this._onLeaveButton.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.values = {
      max: this.max,
      min: this.min,
      step: this.step,
    };
    if (this._inputNode) {
      this._inputNode.role = 'spinbutton';
      this._inputNode.setAttribute('inputmode', 'decimal');
      this._inputNode.setAttribute('autocomplete', 'off');
    }
    this.addEventListener('keydown', this.__keyDownHandler);
    this.__setDefaultValidators();
    this.__toggleSpinnerButtonsState();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.__keyDownHandler);
  }

  /** @param {import('lit').PropertyValues } changedProperties */
  updated(changedProperties) {
    super.updated(changedProperties);

    if (changedProperties.has('modelValue')) {
      this.__toggleSpinnerButtonsState();
    }

    if (changedProperties.has('min')) {
      this._inputNode.min = `${this.min}`;
      this.values.min = this.min;
      if (this.min !== Infinity) {
        this._inputNode.setAttribute('aria-valuemin', `${this.min}`);
      } else {
        this._inputNode.removeAttribute('aria-valuemin');
      }
      this.__toggleSpinnerButtonsState();
    }

    if (changedProperties.has('max')) {
      this._inputNode.max = `${this.max}`;
      this.values.max = this.max;
      if (this.max !== Infinity) {
        this._inputNode.setAttribute('aria-valuemax', `${this.max}`);
      } else {
        this._inputNode.removeAttribute('aria-valuemax');
      }
      this.__toggleSpinnerButtonsState();
    }

    if (changedProperties.has('valueTextMapping')) {
      this._updateAriaAttributes();
    }

    if (changedProperties.has('step')) {
      this._inputNode.step = `${this.step}`;
      this.values.step = this.step;
    }
  }

  get slots() {
    return {
      ...super.slots,
      prefix: () => this.__getDecrementButtonNode(),
      suffix: () => this.__getIncrementButtonNode(),
    };
  }

  /**
   * Set aria labels and apply validators
   * @private
   */
  __setDefaultValidators() {
    const validators = /** @type {(IsNumber| MaxNumber | MinNumber)[]} */ (
      [
        new IsNumber(),
        this.min !== Infinity ? new MinNumber(this.min) : null,
        this.max !== Infinity ? new MaxNumber(this.max) : null,
      ].filter(validator => validator !== null)
    );
    this.defaultValidators.push(...validators);
  }

  /**
   * Update values on keyboard arrow up and down event
   * @param {KeyboardEvent} ev - keyboard event
   * @private
   */
  __keyDownHandler(ev) {
    if (ev.key === 'ArrowUp') {
      this.__increment();
    }

    if (ev.key === 'ArrowDown') {
      this.__decrement();
    }
  }

  /**
   * Toggle disabled state for the buttons
   * @private
   */
  __toggleSpinnerButtonsState() {
    const { min, max } = this.values;
    const decrementButton = /** @type {HTMLButtonElement} */ (this.__getSlot('prefix'));
    const incrementButton = /** @type {HTMLButtonElement} */ (this.__getSlot('suffix'));
    const disableIncrementor = this.currentValue >= max && max !== Infinity;
    const disableDecrementor = this.currentValue <= min && min !== Infinity;
    if (
      (disableDecrementor && decrementButton === document.activeElement) ||
      (disableIncrementor && incrementButton === document.activeElement)
    ) {
      this._inputNode.focus();
    }
    decrementButton[disableDecrementor ? 'setAttribute' : 'removeAttribute']('disabled', 'true');
    incrementButton[disableIncrementor ? 'setAttribute' : 'removeAttribute']('disabled', 'true');
    this._updateAriaAttributes();
  }

  /**
   * @protected
   */
  _updateAriaAttributes() {
    const displayValue = this._inputNode.value;
    if (displayValue) {
      this._inputNode.setAttribute('aria-valuenow', `${displayValue}`);
      if (
        Object.keys(this.valueTextMapping).length !== 0 &&
        Object.keys(this.valueTextMapping).find(key => Number(key) === this.currentValue)
      ) {
        this.__valueText = this.valueTextMapping[this.currentValue];
      } else {
        // VoiceOver announces percentages once the valuemin or valuemax are used.
        // This can be fixed by setting valuetext to the same value as valuenow
        // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-valuenow
        this.__valueText = displayValue;
      }
      this._inputNode.setAttribute('aria-valuetext', `${this.__valueText}`);
    } else {
      this._inputNode.removeAttribute('aria-valuenow');
      this._inputNode.removeAttribute('aria-valuetext');
    }
  }

  /**
   * Get slotted element
   * @param {String} slotName - slot name
   * @returns {HTMLButtonElement|Object}
   * @private
   */
  __getSlot(slotName) {
    return (
      /** @type {HTMLElement[]} */ (Array.from(this.children)).find(
        child => child.slot === slotName,
      ) || {}
    );
  }

  /**
   * Increment the value based on given step or default step value is 1
   * @private
   */
  __increment() {
    const { step, min, max } = this.values;
    const stepMin = min !== Infinity ? min : 0;

    let newValue = this.currentValue + step;

    if ((this.currentValue + stepMin) % step !== 0) {
      // If the value is not aligned to step, align it to the nearest step
      newValue = Math.floor(this.currentValue / step) * step + step + (stepMin % step);
    }

    if (newValue <= max || max === Infinity) {
      this.modelValue = newValue < min && min !== Infinity ? `${min}` : `${newValue}`;
      this.__toggleSpinnerButtonsState();
      this._proxyInputEvent();
    }
  }

  /**
   * Decrement the value based on given step or default step value is 1
   * @private
   */
  __decrement() {
    const { step, max, min } = this.values;
    const stepMin = min !== Infinity ? min : 0;

    let newValue = this.currentValue - step;

    if ((this.currentValue + stepMin) % step !== 0) {
      // If the value is not aligned to step, align it to the nearest step
      newValue = Math.floor(this.currentValue / step) * step + (stepMin % step);
    }

    if (newValue >= min || min === Infinity) {
      this.modelValue = newValue > max && max !== Infinity ? `${max}` : `${newValue}`;
      this.__toggleSpinnerButtonsState();
      this._proxyInputEvent();
    }
  }

  /**
   * Get the increment button node
   * @returns {Element|null}
   * @private
   */
  __getIncrementButtonNode() {
    const renderParent = document.createElement('div');
    render(
      this._incrementorTemplate(),
      renderParent,
      /** @type {RenderOptions} */ ({
        scopeName: this.localName,
        eventContext: this,
      }),
    );
    return renderParent.firstElementChild;
  }

  /**
   * Get the decrement button node
   * @returns {Element|null}
   * @private
   */
  __getDecrementButtonNode() {
    const renderParent = document.createElement('div');
    render(
      this._decrementorTemplate(),
      renderParent,
      /** @type {RenderOptions} */ ({
        scopeName: this.localName,
        eventContext: this,
      }),
    );
    return renderParent.firstElementChild;
  }

  /**
   * Toggle +/- buttons on change
   * @override
   * @protected
   */
  _onChange() {
    super._onChange();
    this.__toggleSpinnerButtonsState();
  }

  /**
   * Get the decrementor button sign template
   * @returns {String|import('lit').TemplateResult}
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this
  _decrementorSignTemplate() {
    return '－';
  }

  /**
   * Get the incrementor button sign template
   * @returns {String|import('lit').TemplateResult}
   * @protected
   */
  // eslint-disable-next-line class-methods-use-this
  _incrementorSignTemplate() {
    return '＋';
  }

  /**
   * Get the increment button template
   * @returns {import('lit').TemplateResult}
   * @protected
   */
  _decrementorTemplate() {
    return html`
      <button
        ?disabled=${this.disabled || this.readOnly}
        @click=${this.__decrement}
        @focus=${this._onEnterButton}
        @blur=${this._onLeaveButton}
        type="button"
        aria-label="${this.msgLit('lion-input-stepper:decrease')}"
      >
        ${this._decrementorSignTemplate()}
      </button>
    `;
  }

  /**
   * Get the decrement button template
   * @returns {import('lit').TemplateResult}
   * @protected
   */
  _incrementorTemplate() {
    return html`
      <button
        ?disabled=${this.disabled || this.readOnly}
        @click=${this.__increment}
        @focus=${this._onEnterButton}
        @blur=${this._onLeaveButton}
        type="button"
        aria-label="${this.msgLit('lion-input-stepper:increase')}"
      >
        ${this._incrementorSignTemplate()}
      </button>
    `;
  }

  /** @protected */
  _inputGroupTemplate() {
    return html`
      <div class="input-stepper__value">${this.__valueText}</div>
      <div class="input-group">
        ${this._inputGroupBeforeTemplate()}
        <div class="input-group__container">
          ${this._inputGroupPrefixTemplate()} ${this._inputGroupInputTemplate()}
          ${this._inputGroupSuffixTemplate()}
        </div>
        ${this._inputGroupAfterTemplate()}
      </div>
    `;
  }

  /**
   * @protected
   * @param {Event} ev
   */
  // eslint-disable-next-line no-unused-vars
  _onEnterButton(ev) {
    const valueNode = /** @type {HTMLElement} */ (
      this.shadowRoot?.querySelector('.input-stepper__value')
    );
    valueNode.setAttribute('aria-live', 'assertive');
  }

  /**
   * Redispatch leave event on host when catching leave event
   * on the incrementor and decrementor button.
   *
   * This redispatched leave event will be caught by
   * InteractionStateMixin to set "touched" state to true.
   *
   * Interacting with the buttons is "user interactions"
   * the same way as focusing + blurring the field (native input)
   *
   * @protected
   * @param {Event} ev
   */
  // eslint-disable-next-line no-unused-vars
  _onLeaveButton(ev) {
    const valueNode = /** @type {HTMLElement} */ (
      this.shadowRoot?.querySelector('.input-stepper__value')
    );
    valueNode.removeAttribute('aria-live');
    this.dispatchEvent(new Event(this._leaveEvent));
  }
}
