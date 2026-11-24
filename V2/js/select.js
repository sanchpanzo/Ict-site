/**
 * select.js — Compact, accessible dropdown for the Analytics filter bar.
 *
 * The native <select> stays in the DOM (and keeps working with keyboard and
 * assistive technology); a lightweight button + popup is layered on top so the
 * control is smaller and easier to scan than the default browser dropdown.
 */

document.addEventListener('DOMContentLoaded', function () {
  const selects = document.querySelectorAll('.filter-bar select');
  const filterBar = document.querySelector('.filter-bar');

  // Keep the toolbar above fixed widgets (music player / chat bubble) while
  // any compact dropdown is open, so its popup is never painted underneath.
  function updateDropdownLayer() {
    if (!filterBar) return;
    const hasOpen = !!filterBar.querySelector('.compact-select.is-open');
    filterBar.classList.toggle('has-open-dropdown', hasOpen);
  }

  selects.forEach(function (select) {
    const options = Array.from(select.options);
    if (!options.length) return;

    const label = select.closest('.filter-group').querySelector('label');
    if (label && !label.id) label.id = label.getAttribute('for') + '-label';

    const wrapper = document.createElement('div');
    wrapper.className = 'compact-select';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'compact-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    if (label && label.id) trigger.setAttribute('aria-labelledby', label.id);

    const valueEl = document.createElement('span');
    valueEl.className = 'compact-select-value';

    const chevron = document.createElement('span');
    chevron.className = 'compact-select-chevron';
    chevron.setAttribute('aria-hidden', 'true');

    trigger.appendChild(valueEl);
    trigger.appendChild(chevron);

    const panel = document.createElement('div');
    panel.className = 'compact-select-panel';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;
    if (label && label.id) panel.setAttribute('aria-labelledby', label.id);

    const optionEls = options.map(function (option, index) {
      const item = document.createElement('div');
      item.className = 'compact-select-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.dataset.value = option.value;
      item.tabIndex = -1;
      item.id = select.id + '-option-' + index;
      item.textContent = option.textContent;
      panel.appendChild(item);
      return item;
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    select.classList.add('native-select-hidden');
    select.parentNode.insertBefore(wrapper, select.nextSibling);

    const longest = options.reduce(function (max, option) {
      return Math.max(max, option.textContent.length);
    }, 8);
    wrapper.style.minWidth = Math.min(210, Math.max(112, longest * 7.4 + 44)) + 'px';

    let activeIndex = Math.max(0, options.findIndex(function (o) { return o.selected; }));

    function currentText() {
      const selected = options.find(function (o) { return o.value === select.value; });
      return selected ? selected.textContent : (options[0] ? options[0].textContent : '');
    }

    function sync() {
      valueEl.textContent = currentText();
      optionEls.forEach(function (item) {
        const isSelected = item.dataset.value === select.value;
        item.setAttribute('aria-selected', String(isSelected));
        item.classList.toggle('is-selected', isSelected);
      });
      activeIndex = Math.max(0, options.findIndex(function (o) { return o.value === select.value; }));
    }

    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      wrapper.classList.add('is-open');
      updateDropdownLayer();

      // Flip the popup above the trigger when there is not enough room below,
      // so it stays fully visible instead of disappearing behind other blocks.
      const triggerRect = trigger.getBoundingClientRect();
      const panelHeight = Math.min(panel.scrollHeight, 230);
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top - 80; // leave room for the sticky header
      wrapper.classList.toggle('is-above', spaceBelow < panelHeight + 16 && spaceAbove > spaceBelow);

      highlight(activeIndex);
    }

    function close(returnFocus) {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      wrapper.classList.remove('is-open');
      updateDropdownLayer();
      if (returnFocus) trigger.focus();
    }

    function highlight(index) {
      activeIndex = Math.max(0, Math.min(options.length - 1, index));
      optionEls.forEach(function (item, i) {
        item.classList.toggle('is-active', i === activeIndex);
      });
      const active = optionEls[activeIndex];
      if (active) {
        trigger.setAttribute('aria-activedescendant', active.id);
        // Scroll only the popup — scrollIntoView() would also scroll the page
        // and drag the whole toolbar out from under the pointer.
        if (active.offsetTop < panel.scrollTop) {
          panel.scrollTop = active.offsetTop - 4;
        } else if (active.offsetTop + active.offsetHeight > panel.scrollTop + panel.clientHeight) {
          panel.scrollTop = active.offsetTop + active.offsetHeight - panel.clientHeight + 4;
        }
      }
    }

    function choose(index) {
      const option = options[index];
      if (!option) return;
      select.value = option.value;
      sync();
      close(true);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    trigger.addEventListener('click', function () {
      if (panel.hidden) open(); else close(false);
    });

    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (panel.hidden) {
          open();
        } else {
          optionEls[activeIndex].focus();
        }
      }
    });

    panel.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlight(activeIndex + 1);
        optionEls[activeIndex].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlight(activeIndex - 1);
        optionEls[activeIndex].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        highlight(0);
        optionEls[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        highlight(options.length - 1);
        optionEls[activeIndex].focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose(activeIndex);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab') {
        close(false);
      }
    });

    optionEls.forEach(function (item, index) {
      item.addEventListener('click', function () { choose(index); });
      item.addEventListener('mousemove', function () { highlight(index); });
    });

    document.addEventListener('click', function (event) {
      if (!wrapper.contains(event.target)) close(false);
    });

    select.addEventListener('change', sync);
    sync();
  });

  // Desktop segmented buttons stay in sync with the native selects,
  // the compact mobile dropdowns, and the Reset button.
  document.querySelectorAll('.segmented-options').forEach(function (group) {
    const select = document.getElementById(group.dataset.filter);
    if (!select) return;

    const buttons = Array.from(group.querySelectorAll('.segmented-option'));
    function syncButtons() {
      buttons.forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.value === select.value));
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        select.value = button.dataset.value;
        syncButtons();
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    select.addEventListener('change', syncButtons);
    syncButtons();
  });
});
