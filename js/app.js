// Git Interactive Tutorial — interface
// ==========================================================================
// Layout: curriculum sidebar + data flow + tutorial card + terminal/inspector.
// The simulator core reuses GitTutorial.GitState / Parser / commands; the
// interface itself is implemented here.
// ==========================================================================
(function () {
  'use strict';

  var GT = window.GitTutorial;
  if (!GT) {
    document.body.insertAdjacentHTML('afterbegin',
      '<pre style="padding:20px;color:#a13a2f;font-size:16px">' +
      'Core scripts failed to load: make sure js/state.js and the other files ' +
      'are in the same directory as index.html.</pre>');
    return;
  }

  var STORAGE_KEY = 'git-playground-v1';
  var cards = GT.tutorials;
  var state = new GT.GitState();
  var parser = new GT.Parser(state, GT.commands);

  var currentCard = 0;
  var completed = {};
  var arrows = {
    add: false, commit: false, push: false,
    pull: false, clone: false, restore: false
  };
  var inspectorTab = 'working';
  var openChapters = {};
  var termHistoryIndex = 0;
  var currentFile = null;
  var currentFileZone = null;
  var selectedFile = null;
  var contextFile = null;
  var demoMode = false;
  var noSave = false;

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    progressLabel: $('progress-label'),
    progressPercent: $('progress-percent'),
    progressFill: $('progress-fill'),
    statusChip: $('status-chip'),
    sidebarCount: $('sidebar-count'),
    chapterNav: $('chapter-nav'),
    cardChapter: $('card-chapter'),
    cardIndex: $('card-index'),
    cardTitle: $('card-title'),
    cardContent: $('card-content'),
    cardTask: $('card-task'),
    taskPrompt: $('task-prompt'),
    taskState: $('task-state'),
    cardPrev: $('card-prev'),
    cardNext: $('card-next'),
    flow: $('flow'),
    countWorking: $('count-working'),
    countStaging: $('count-staging'),
    countLocal: $('count-local'),
    countRemote: $('count-remote'),
    tabCountWorking: $('tab-count-working'),
    tabCountStaging: $('tab-count-staging'),
    tabCountLocal: $('tab-count-local'),
    tabCountRemote: $('tab-count-remote'),
    inspectorTabs: $('inspector-tabs'),
    inspectorBody: $('inspector-body'),
    inspectorSelection: $('inspector-selection'),
    inspectorSelectionName: $('inspector-selection-name'),
    inspectorSelectionZone: $('inspector-selection-zone'),
    terminalOutput: $('terminal-output'),
    terminalBody: $('terminal-body'),
    terminalForm: $('terminal-form'),
    terminalInput: $('terminal-input'),
    logSession: $('log-session'),
    chips: $('chips'),
    helpDialog: $('help-dialog'),
    helpCommands: $('help-commands'),
    fileDialog: $('file-dialog'),
    fileTitle: $('file-title'),
    fileDiff: $('file-diff'),
    fileEditor: $('file-editor'),
    fileNote: $('file-note'),
    fileSave: $('file-save'),
    promptDialog: $('prompt-dialog'),
    promptInput: $('prompt-input'),
    promptOk: $('prompt-ok'),
    promptTitle: $('prompt-title'),
    ctxMenu: $('ctx-menu'),
    toastStack: $('toast-stack'),
    detailsDialog: $('details-dialog'),
    detailsTitle: $('details-title'),
    detailsContent: $('details-content')
  };

  // ======================================================================
  // Utilities
  // ======================================================================
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeUrl(url) {
    var u = String(url || '').trim();
    if (/^\s*(javascript|data|vbscript):/i.test(u)) return '#';
    return escapeHtml(u);
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function normalizeText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim()
      .replace(/["']/g, '');
  }

  function commandName(input) {
    var parts = String(input || '').trim().split(/\s+/);
    if (!parts.length) return '';
    return parts[0] === 'git' ? (parts[1] || 'git') : parts[0];
  }

  function statusLabel(status) {
    return {
      new: ['?', 'new', 'new'],
      modified: ['M', 'modified', 'modified'],
      staged: ['A', 'staged', 'staged'],
      deleted: ['D', 'deleted', 'deleted'],
      committed: ['·', '', 'committed']
    }[status] || ['·', '', status];
  }

  function zoneLabel(zone) {
    return zone === 'staging' ? 'Staging Area' : 'Working Directory';
  }

  function toast(message, type) {
    var div = document.createElement('div');
    div.className = 'toast ' + (type || '');
    div.textContent = message;
    els.toastStack.appendChild(div);
    setTimeout(function () {
      div.classList.add('is-leaving');
      setTimeout(function () { div.remove(); }, 220);
    }, 2800);
  }

  function showError(message) {
    var old = document.getElementById('js-error-banner');
    if (old) old.remove();
    var div = document.createElement('div');
    div.id = 'js-error-banner';
    div.className = 'js-error';
    div.textContent = 'Page script error: ' + message;
    document.body.appendChild(div);
  }

  window.addEventListener('error', function (e) {
    if (e && e.message) showError(e.message);
  });

  // Selected file, shown next to the inspector tabs instead of a toast.
  function setSelection(name, zone) {
    selectedFile = { name: name, zone: zone };
    els.inspectorSelectionName.textContent = name;
    els.inspectorSelectionZone.textContent = zoneLabel(zone);
    els.inspectorSelection.hidden = false;
  }

  function clearSelection() {
    selectedFile = null;
    els.inspectorSelection.hidden = true;
    els.inspectorSelectionName.textContent = '';
    els.inspectorSelectionZone.textContent = '';
  }

  // ======================================================================
  // Markdown
  // ======================================================================
  function inlineMarkdown(text) {
    var codeSpans = [];
    var s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, function (m, inner) {
      codeSpans.push(inner);
      return '\u0000C' + (codeSpans.length - 1) + '\u0000';
    });
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/!\[([^\]]*)\]\(([^()\s]+)\)/g, function (m, alt, url) {
      return '<img src="' + safeUrl(url) + '" alt="' + alt + '" style="max-width:100%">';
    });
    s = s.replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, function (m, label, url) {
      return '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener noreferrer">' +
        label + '</a>';
    });
    s = s.replace(/\u0000C(\d+)\u0000/g, function (m, i) {
      return '<code>' + codeSpans[+i] + '</code>';
    });
    return s;
  }

  function renderMarkdown(md) {
    var lines = String(md || '').split('\n');
    var html = '';
    var inCode = false;
    var codeLines = [];
    var items = [];

    function flushItems() {
      if (items.length) {
        html += '<ul>' + items.join('') + '</ul>';
        items = [];
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*```/.test(line)) {
        if (!inCode) {
          flushItems();
          inCode = true;
          codeLines = [];
        } else {
          inCode = false;
          html += '<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>';
        }
        continue;
      }
      if (inCode) { codeLines.push(line); continue; }

      var m;
      if (/^\s*$/.test(line)) {
        flushItems();
        continue;
      }
      m = line.match(/^### (.+)$/);
      if (m) { flushItems(); html += '<h3>' + inlineMarkdown(m[1]) + '</h3>'; continue; }
      m = line.match(/^## (.+)$/);
      if (m) { flushItems(); html += '<h2>' + inlineMarkdown(m[1]) + '</h2>'; continue; }
      m = line.match(/^- (.+)$/);
      if (m) { items.push('<li>' + inlineMarkdown(m[1]) + '</li>'); continue; }
      m = line.match(/^>\s?(.+)$/);
      if (m) {
        flushItems();
        html += '<blockquote>' + inlineMarkdown(m[1]) + '</blockquote>';
        continue;
      }
      flushItems();
      html += '<p>' + inlineMarkdown(line) + '</p>';
    }
    flushItems();
    if (inCode) {
      html += '<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>';
    }
    return html;
  }

  // ======================================================================
  // Persistence
  // ======================================================================
  var STATE_FIELDS = [
    'initialized', 'workingDir', 'staging', 'commits', 'branches',
    'currentBranch', 'HEAD', 'remote', 'stash', 'tags', 'config',
    'mergeConflict', 'mergeConflictKinds', 'pendingMerge'
  ];

  function save() {
    if (noSave) return;
    try {
      var st = {};
      for (var i = 0; i < STATE_FIELDS.length; i++) {
        st[STATE_FIELDS[i]] = state[STATE_FIELDS[i]];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        state: st,
        cardIndex: currentCard,
        completed: completed,
        arrows: arrows,
        inspectorTab: inspectorTab
      }));
    } catch (e) { /* Ignore storage failures silently. */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (data.state) {
        for (var i = 0; i < STATE_FIELDS.length; i++) {
          var k = STATE_FIELDS[i];
          if (data.state[k] !== undefined) state[k] = data.state[k];
        }
      }
      if (typeof data.cardIndex === 'number') {
        currentCard = clamp(data.cardIndex, 0, cards.length - 1);
      }
      if (data.completed) completed = data.completed;
      if (data.arrows) {
        for (var a in arrows) {
          if (data.arrows[a]) arrows[a] = true;
        }
      }
      if (data.inspectorTab) inspectorTab = data.inspectorTab;
      return true;
    } catch (e) { return false; }
  }

  // ======================================================================
  // Header / data flow
  // ======================================================================
  function isDirty() {
    for (var f in state.workingDir) {
      if (state.workingDir[f].status !== 'committed') return true;
    }
    return Object.keys(state.staging).length > 0;
  }

  function renderHeader() {
    var pct = Math.round(((currentCard + 1) / cards.length) * 100);
    els.progressLabel.textContent = 'Card ' + (currentCard + 1) + ' / ' + cards.length;
    els.progressPercent.textContent = pct + '%';
    els.progressFill.style.width = pct + '%';

    var doneCount = Object.keys(completed).length;
    var taskTotal = cards.filter(function (c) { return !!c.task; }).length;
    els.sidebarCount.textContent = doneCount + ' / ' + taskTotal + ' tasks complete';

    var chip = els.statusChip;
    chip.classList.remove('is-clean', 'is-dirty', 'is-conflict');
    if (!state.initialized) {
      chip.textContent = 'Not initialized';
      return;
    }
    if (state.mergeConflict && state.mergeConflict.length > 0) {
      chip.classList.add('is-conflict');
      chip.textContent = state.mergeConflict.length +
        (state.mergeConflict.length === 1 ? ' conflict' : ' conflicts');
      return;
    }
    var branch = state.currentBranch || 'detached HEAD';
    var dirty = isDirty();
    chip.classList.add(dirty ? 'is-dirty' : 'is-clean');
    chip.textContent = branch + ' · ' + (dirty ? 'dirty' : 'clean');
  }

  function renderFlow() {
    els.countWorking.textContent = Object.keys(state.workingDir).length;
    els.countStaging.textContent = Object.keys(state.staging).length;
    els.countLocal.textContent = state.commits.length;
    els.countRemote.textContent = (state.remote.commits || []).length;

    var links = document.querySelectorAll('.flow-link[data-arrow]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('is-active', !!arrows[links[i].getAttribute('data-arrow')]);
    }
    var chips = document.querySelectorAll('.return-chip[data-arrow]');
    for (var j = 0; j < chips.length; j++) {
      chips[j].classList.toggle('is-active', !!arrows[chips[j].getAttribute('data-arrow')]);
    }
    var nodes = document.querySelectorAll('.flow-node[data-zone]');
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].classList.toggle('is-active', nodes[k].getAttribute('data-zone') === inspectorTab);
    }
  }

  function flashZone(zone) {
    var el = document.querySelector('.flow-node[data-zone="' + zone + '"]');
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(function () { el.classList.remove('is-flash'); }, 600);
  }

  var ARROW_MAP = {
    add: ['add'],
    commit: ['commit'],
    push: ['push'],
    pull: ['pull'],
    fetch: ['pull'],
    clone: ['clone'],
    restore: ['restore'],
    checkout: ['restore'],
    switch: ['restore']
  };

  var ZONE_BY_CMD = {
    init: 'working', clone: 'working', touch: 'working', echo: 'working',
    del: 'working', edit: 'working', pull: 'working', checkout: 'working',
    switch: 'working', restore: 'working', stash: 'working',
    'reset-tutorial': 'working',
    add: 'staging',
    commit: 'local', merge: 'local', rebase: 'local', reset: 'local',
    revert: 'local', 'cherry-pick': 'local',
    push: 'remote', fetch: 'remote'
  };

  function revealForCommand(cmd) {
    var names = ARROW_MAP[cmd];
    if (names) {
      for (var i = 0; i < names.length; i++) arrows[names[i]] = true;
    }
    var zone = ZONE_BY_CMD[cmd];
    if (zone) {
      inspectorTab = zone;
      flashZone(zone);
    }
  }

  // ======================================================================
  // Curriculum sidebar
  // ======================================================================
  function renderSidebar() {
    var chapters = GT.chapters;
    var html = '';
    for (var i = 0; i < chapters.length; i++) {
      var ch = chapters[i];
      var chapterNo = i + 1;
      var isOpen = openChapters[chapterNo];
      var hasCurrent = false;
      for (var c = 0; c < ch.cards.length; c++) {
        var idx = cards.indexOf(ch.cards[c]);
        if (idx === currentCard) hasCurrent = true;
      }
      html += '<div class="chapter-group">';
      html += '<button type="button" class="chapter-toggle' +
        (isOpen ? ' is-open' : '') + '" data-chapter="' + chapterNo + '">' +
        '<span class="chapter-num">' + String(chapterNo).padStart(2, '0') + '</span>' +
        '<span>' + escapeHtml(ch.title) + '</span>' +
        '<span class="chev" aria-hidden="true">▶</span></button>';
      html += '<div class="chapter-cards"' + (isOpen ? '' : ' hidden') + '>';
      for (var j = 0; j < ch.cards.length; j++) {
        var card = ch.cards[j];
        var realIndex = cards.indexOf(card);
        var cls = 'chapter-card';
        if (realIndex === currentCard) cls += ' is-current';
        if (completed[card.id]) cls += ' is-done';
        html += '<button type="button" class="' + cls + '" data-card="' +
          realIndex + '">' + escapeHtml(card.title) + '</button>';
      }
      html += '</div></div>';
      if (hasCurrent) { /* Keep the current chapter open. */ }
    }
    var navScroll = els.chapterNav.scrollTop;
    els.chapterNav.innerHTML = html;
    els.chapterNav.scrollTop = navScroll;
  }

  // ======================================================================
  // Tutorial card
  // ======================================================================
  function renderCard() {
    var card = cards[currentCard];
    if (!card) return;
    els.cardChapter.textContent = 'Chapter ' + card.chapter;
    els.cardIndex.textContent = (currentCard + 1) + ' / ' + cards.length;
    els.cardTitle.textContent = card.title;
    els.cardContent.innerHTML = renderMarkdown(card.content);
    els.cardContent.scrollTop = 0;
    els.cardPrev.disabled = currentCard === 0;
    els.cardNext.disabled = currentCard === cards.length - 1;

    if (card.task && card.task.prompt) {
      els.cardTask.hidden = false;
      els.taskPrompt.innerHTML = card.task.prompt;
      updateTaskState();
    } else {
      els.cardTask.hidden = true;
      els.taskPrompt.textContent = '';
    }
  }

  function updateTaskState() {
    var card = cards[currentCard];
    if (!card || !card.task) return;
    var done = !!completed[card.id];
    els.cardTask.classList.toggle('is-done', done);
    els.taskState.textContent = done ? 'Completed ✓' : '';
  }

  function showCard(index) {
    index = clamp(index, 0, cards.length - 1);
    if (index === currentCard && els.cardContent.innerHTML) {
      // Re-render anyway so clicking the current card in the sidebar refreshes it.
    }
    currentCard = index;
    openChapters[cards[index].chapter] = true;
    renderCard();
    renderSidebar();
    renderHeader();
    save();
  }

  function buildHelpCommands() {
    if (!els.helpCommands) return;
    var list = [
      ['git init', 'Initialize a repository'],
      ['git clone <url>', 'Clone a remote repository'],
      ['git add <file>', 'Stage files (wildcards such as *.py are supported)'],
      ['git status', 'Show working directory and staging status'],
      ['git commit -m "message"', 'Record the staging area as a snapshot'],
      ['git diff [--staged]', 'Compare unstaged or staged changes'],
      ['git log', 'Show commit history'],
      ['git branch [name]', 'List / create branches; -d deletes, -m renames'],
      ['git checkout <branch>', 'Switch branches or check out a historical commit'],
      ['git switch <branch>', 'Switch branches (new command)'],
      ['git merge <branch>', 'Merge a branch into the current branch'],
      ['git push [remote] [branch]', 'Push to a remote'],
      ['git pull [remote] [branch]', 'Fetch and merge remote updates'],
      ['git fetch [remote]', 'Fetch remote updates without merging'],
      ['git rebase <branch>', 'Replay commits onto another branch'],
      ['git stash [save|pop|apply|list]', 'Shelve working-tree changes temporarily'],
      ['git cherry-pick <hash>', 'Apply a single commit to the current branch'],
      ['git reset [--soft|--mixed|--hard] <commit>', 'Move HEAD'],
      ['git revert <hash>', 'Undo an older commit with a new commit'],
      ['git tag [name]', 'Create / list tags; -d deletes'],
      ['git rm [--cached] <file>', 'Delete a file / stop tracking it'],
      ['git restore [--staged] <file>', 'Restore a file / unstage changes'],
      ['git config [--global] <key> [value]', 'Configure user name and email'],
      ['git remote [add|remove|-v] <name> [url]', 'Manage remotes'],
      ['git show <commit|tag>', 'Show commit details'],
      ['git blame <file>', 'Trace the last author of each line'],
      ['touch <file>', 'Create an empty file'],
      ['echo "text" > file', 'Write to a file (>> appends)'],
      ['cat <file>', 'Print file contents'],
      ['clear', 'Clear the terminal'],
      ['help', 'Show the command list'],
      ['reset-tutorial', 'Reset the repository state']
    ];
    var html = '';
    for (var i = 0; i < list.length; i++) {
      html += '<div class="help-cmd"><code>' + escapeHtml(list[i][0]) +
        '</code><span>' + escapeHtml(list[i][1]) + '</span></div>';
    }
    els.helpCommands.innerHTML = html;
  }

  // ======================================================================
  // Terminal
  // ======================================================================
  function appendTerminalLine(text, cls) {
    var div = document.createElement('div');
    div.className = 't-line' + (cls ? ' ' + cls : '');
    div.textContent = text;
    els.terminalOutput.appendChild(div);
    return div;
  }

  function appendTerminalInput(input) {
    var parts = input.trim().split(/\s+/);
    var div = document.createElement('div');
    div.className = 't-line t-input';
    var html = '<span class="t-prompt">$ </span>';
    if (parts[0] === 'git' && parts.length > 1) {
      html += '<span class="t-git">git</span> <span class="t-sub">' +
        escapeHtml(parts[1]) + '</span>';
      if (parts.length > 2) html += ' ' + escapeHtml(parts.slice(2).join(' '));
    } else if (parts[0]) {
      html += '<span class="t-git">' + escapeHtml(parts[0]) + '</span>';
      if (parts.length > 1) html += ' ' + escapeHtml(parts.slice(1).join(' '));
    }
    div.innerHTML = html;
    els.terminalOutput.appendChild(div);
  }

  function appendOutput(result, cmd) {
    if (!result) return;
    var output = result.output || '';
    if (output === '__CLEAR__') {
      clearTerminal();
      return;
    }
    if (!output) return;
    var lines = output.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cls = '';
      if (!result.success) {
        cls = 't-error';
      } else if (cmd === 'diff' || cmd === 'show') {
        if (/^diff --git/.test(line) || /^--- /.test(line) || /^\+\+\+ /.test(line)) {
          cls = 't-bold';
        } else if (/^@@/.test(line)) {
          cls = 't-hunk';
        } else if (line.charAt(0) === '+') {
          cls = 't-add';
        } else if (line.charAt(0) === '-') {
          cls = 't-del';
        }
      }
      if (line === '') {
        appendTerminalLine('', cls);
      } else {
        appendTerminalLine(line, cls);
      }
    }
  }

  function scrollTerminal() {
    els.terminalBody.scrollTop = els.terminalBody.scrollHeight;
    els.terminalOutput.scrollTop = els.terminalOutput.scrollHeight;
  }

  function clearTerminal() {
    els.terminalOutput.innerHTML = '';
    termHistoryIndex = parser.history.length;
  }

  function appendQuickReference() {
    appendTerminalLine('Quick reference', 't-ref');
    appendTerminalLine('  git init             initialize a repository', 't-ref');
    appendTerminalLine('  git status           inspect the working tree', 't-ref');
    appendTerminalLine('  git add .            stage changes', 't-ref');
    appendTerminalLine('  git commit -m "msg"  record a snapshot', 't-ref');
    appendTerminalLine('  git log              browse commit history', 't-ref');
    appendTerminalLine('  git push             publish to a remote', 't-ref');
    appendTerminalLine('  git pull             fetch and merge updates', 't-ref');
    appendTerminalLine('', '');
    appendTerminalLine('Type help for the full command reference.', 't-muted');
    appendTerminalLine('', '');
  }

  function welcome() {
    clearTerminal();
    appendTerminalLine('Git Interactive Tutorial', 't-ok');
    appendTerminalLine('Type Git commands below. Tab completes, ↑/↓ navigates history, and ? opens help.', 't-muted');
    if (demoMode) {
      appendTerminalLine('Demo data loaded. Try running git status.', 't-muted');
    } else if (state.initialized) {
      appendTerminalLine('Restored the repository from your previous session.', 't-muted');
    } else {
      appendTerminalLine('Start with: git init', 't-muted');
    }
    appendTerminalLine('', '');
    appendQuickReference();
  }

  function checkTask(input) {
    var card = cards[currentCard];
    if (!card || !card.task || !card.task.prompt) return;
    var expected = card.task.prompt.match(/<code>([^<]+)<\/code>/g) || [];
    var normalized = normalizeText(input);
    for (var i = 0; i < expected.length; i++) {
      var exp = normalizeText(expected[i].replace(/<\/?code>/g, ''));
      if (!exp) continue;
      if (normalized === exp ||
          (!/\s-/.test(exp) && normalized.indexOf(exp + ' ') === 0)) {
        if (!completed[card.id]) {
          completed[card.id] = true;
          updateTaskState();
          toast('Task complete: ' + card.title, 'ok');
          renderSidebar();
          renderHeader();
          save();
        }
        return;
      }
    }
  }

  function execute(input) {
    if (!input || !input.trim()) return;
    var text = input.trim();
    appendTerminalInput(text);
    var result = parser.parse(text);
    termHistoryIndex = parser.history.length;
    if (result) {
      var cmd = commandName(text);
      appendOutput(result, cmd);
      if (result.success) {
        revealForCommand(cmd);
        checkTask(text);
      }
      renderFlow();
      renderInspector();
      renderSidebar();
      renderHeader();
      save();
    }
    scrollTerminal();
    els.terminalInput.value = '';
    els.terminalInput.focus();
  }

  // ======================================================================
  // Tab completion
  // ======================================================================
  var GIT_SUBCOMMANDS = [
    'init', 'clone', 'add', 'status', 'commit', 'diff', 'log', 'branch',
    'checkout', 'switch', 'merge', 'push', 'pull', 'fetch', 'rebase',
    'stash', 'cherry-pick', 'reset', 'revert', 'tag', 'rm', 'restore',
    'config', 'remote', 'show', 'blame'
  ];
  var HELPER_COMMANDS = ['touch', 'echo', 'cat', 'clear', 'help',
    'reset-tutorial'];
  var FLAGS = {
    add: ['--all', '--update', '--patch', '--intent-to-add'],
    restore: ['--staged', '--worktree', '--source', '--cached', '-s'],
    rm: ['--cached', '--force', '-r'],
    reset: ['--soft', '--mixed', '--hard'],
    commit: ['--message', '--amend', '-m'],
    checkout: ['-b', '--'],
    switch: ['-c', '-C', '--'],
    merge: ['--no-ff', '--abort', '--'],
    tag: ['-a', '-d', '-l'],
    branch: ['-d', '-D', '-m', '-M'],
    stash: ['push', 'pop', 'list', 'apply', 'drop', 'show', 'clear', '-u'],
    diff: ['--staged', '--cached', '--name-only', '--stat'],
    log: ['--oneline', '--stat', '--graph', '-p', '-n'],
    remote: ['-v', 'add', 'remove', 'rename', 'show'],
    fetch: ['--all', '--prune'],
    pull: ['--rebase', '--no-ff'],
    push: ['--force', '-u', '--set-upstream', '--delete'],
    rebase: ['--continue', '--abort', '--skip'],
    'cherry-pick': ['--continue', '--abort', '-x']
  };

  function commonPrefix(arr) {
    if (!arr.length) return '';
    var p = arr[0];
    for (var i = 1; i < arr.length; i++) {
      while (arr[i].indexOf(p) !== 0) {
        p = p.slice(0, -1);
        if (!p) return '';
      }
    }
    return p;
  }

  function candidatesFor(sub) {
    var files = Object.keys(state.workingDir);
    var branches = Object.keys(state.branches);
    var tags = Object.keys(state.tags);
    var revisions = branches.concat(tags).concat(['HEAD']);
    if (['add', 'rm', 'restore', 'diff', 'blame', 'cat'].indexOf(sub) !== -1) return files;
    if (sub === 'checkout' || sub === 'switch') return branches;
    if (sub === 'merge' || sub === 'rebase') return branches;
    if (sub === 'branch') return branches;
    if (['reset', 'revert', 'cherry-pick', 'show'].indexOf(sub) !== -1) return revisions;
    if (['push', 'pull', 'fetch'].indexOf(sub) !== -1) return branches.concat(['origin']);
    if (sub === 'stash') return ['save', 'pop', 'apply', 'list'];
    if (sub === 'tag') return tags;
    if (sub === 'config') return ['user.name', 'user.email'];
    if (sub === 'remote') return ['add', 'remove', '-v'];
    return files;
  }

  function completeInput() {
    var val = els.terminalInput.value;
    var trailing = /\s$/.test(val);
    var tokens = val.split(/\s+/).filter(Boolean);
    var prefix = '';
    var candidates = [];

    if (!tokens.length) {
      candidates = ['git'].concat(HELPER_COMMANDS);
    } else if (tokens[0] === 'git') {
      if (tokens.length === 1) {
        candidates = GIT_SUBCOMMANDS;
      } else if (tokens.length === 2 && tokens[1].charAt(0) !== '-' &&
                 GIT_SUBCOMMANDS.indexOf(tokens[1]) === -1) {
        candidates = GIT_SUBCOMMANDS;
        prefix = tokens[1];
      } else {
        var sub = tokens[1];
        var last = trailing ? '' : tokens[tokens.length - 1];
        var prev = trailing ? tokens[tokens.length - 1] : '';
        if (trailing && (prev === '-b' || prev === '-c' || prev === '-C')) {
          candidates = [];
        } else if (trailing && (prev === '--source' || prev === '-s')) {
          candidates = Object.keys(state.branches).concat(Object.keys(state.tags)).concat(['HEAD']);
        } else if (trailing && (prev === '-d' || prev === '-D')) {
          candidates = sub === 'tag' ? Object.keys(state.tags) : Object.keys(state.branches);
        } else if (trailing && (prev === '-m' || prev === '--message')) {
          candidates = [];
        } else if (last.charAt(0) === '-') {
          candidates = FLAGS[sub] || [];
          prefix = last;
        } else {
          candidates = candidatesFor(sub);
          prefix = trailing ? '' : last;
        }
      }
    } else if (HELPER_COMMANDS.indexOf(tokens[0]) !== -1) {
      candidates = Object.keys(state.workingDir);
      prefix = trailing ? '' : tokens[tokens.length - 1];
    }

    var matches = candidates.filter(function (c) { return c.indexOf(prefix) === 0; });
    if (!matches.length) return;
    var chosen;
    if (matches.length === 1) {
      chosen = matches[0];
    } else {
      chosen = commonPrefix(matches);
      if (chosen.length <= prefix.length) return;
    }
    if (trailing) tokens.push(chosen);
    else if (tokens.length) tokens[tokens.length - 1] = chosen;
    else tokens = [chosen];
    els.terminalInput.value = tokens.join(' ') + (matches.length === 1 ? ' ' : '');
    els.terminalInput.setSelectionRange(els.terminalInput.value.length,
                                        els.terminalInput.value.length);
  }

  // ======================================================================
  // Repository inspector
  // ======================================================================
  function statusBadge(status) {
    var s = statusLabel(status);
    return '<span class="file-badge">' + s[2] + '</span>';
  }

  function renderLogSide() {
    if (!els.logSession) return;
    var initialized = state.initialized;
    var branch = initialized ? (state.currentBranch || 'detached HEAD') : '—';
    var head = state.HEAD ? state.HEAD.substring(0, 7) : '—';
    var status;
    if (!initialized) {
      status = 'Not initialized';
    } else if (state.mergeConflict && state.mergeConflict.length > 0) {
      status = state.mergeConflict.length +
        (state.mergeConflict.length === 1 ? ' conflict' : ' conflicts');
    } else {
      status = isDirty() ? 'Dirty' : 'Clean';
    }

    var done = Object.keys(completed).length;
    var taskTotal = cards.filter(function (c) { return !!c.task; }).length;
    var pct = taskTotal ? Math.round((done / taskTotal) * 100) : 0;

    var lastCmd = parser.history.length
      ? parser.history[parser.history.length - 1]
      : '—';

    els.logSession.innerHTML =
      '<div class="log-side-section">' +
        '<h3 class="log-side-title">Session</h3>' +
        '<dl class="log-kv">' +
          '<div><dt>Branch</dt><dd>' + escapeHtml(branch) + '</dd></div>' +
          '<div><dt>HEAD</dt><dd>' + escapeHtml(head) + '</dd></div>' +
          '<div><dt>Status</dt><dd>' + escapeHtml(status) + '</dd></div>' +
          '<div><dt>Tasks</dt><dd>' + done + ' / ' + taskTotal + '</dd></div>' +
          '<div><dt>Last</dt><dd>' + escapeHtml(lastCmd) + '</dd></div>' +
        '</dl>' +
        '<div class="log-progress"><span style="width:' + pct + '%"></span></div>' +
      '</div>' +
      '<div class="log-side-section">' +
        '<h3 class="log-side-title">Repository</h3>' +
        '<div class="log-counts">' +
          '<div class="log-count"><span>' + Object.keys(state.workingDir).length +
            '</span><small>Working</small></div>' +
          '<div class="log-count"><span>' + Object.keys(state.staging).length +
            '</span><small>Staged</small></div>' +
          '<div class="log-count"><span>' + state.commits.length +
            '</span><small>Commits</small></div>' +
          '<div class="log-count"><span>' + (state.remote.commits || []).length +
            '</span><small>Remote</small></div>' +
        '</div>' +
      '</div>';
  }

  var lastInspectorTab = null;

  function renderInspector() {
    renderLogSide();
    var keepScroll = lastInspectorTab === inspectorTab
      ? els.inspectorBody.scrollTop : 0;
    lastInspectorTab = inspectorTab;
    // Tab state and counts
    var tabs = els.inspectorTabs.querySelectorAll('.tab');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].classList.toggle('is-active', tabs[t].getAttribute('data-tab') === inspectorTab);
    }
    els.tabCountWorking.textContent = Object.keys(state.workingDir).length;
    els.tabCountStaging.textContent = Object.keys(state.staging).length;
    els.tabCountLocal.textContent = state.commits.length;
    els.tabCountRemote.textContent = (state.remote.commits || []).length;

    // Drop a stale file selection once the file no longer exists in that area.
    if (selectedFile) {
      if (selectedFile.zone === 'working' && !state.workingDir[selectedFile.name]) {
        clearSelection();
      } else if (selectedFile.zone === 'staging' && !state.staging[selectedFile.name]) {
        clearSelection();
      }
    }

    var html = '';
    if (!state.initialized) {
      els.inspectorBody.innerHTML =
        '<div class="inspector-empty"><strong>Repository not initialized</strong>' +
        'Run <code>git init</code> in the terminal to begin.</div>';
      renderFlow();
      return;
    }

    if (inspectorTab === 'working') {
      html += '<div class="inspector-toolbar"><span>Double-click to view / edit · Right-click to create or delete</span>' +
        '<span>' + Object.keys(state.workingDir).length + ' files</span></div>';
      if (state.mergeConflict && state.mergeConflict.length > 0) {
        html += '<div class="inspector-empty inspector-alert">' +
          '<strong>' + state.mergeConflict.length + ' file' +
          (state.mergeConflict.length === 1 ? '' : 's') + ' require conflict resolution</strong>' +
          'Edit the files to remove the conflict markers, then <code>git add</code>.</div>';
      }
      if (!Object.keys(state.workingDir).length) {
        html += '<div class="inspector-empty"><strong>The working directory is empty</strong>' +
          'Create a file with <code>touch readme.md</code> or the “+ New” button.</div>';
      } else {
        for (var f in state.workingDir) {
          var wd = state.workingDir[f];
          var conflict = state.mergeConflict && state.mergeConflict.indexOf(f) !== -1;
          var st = conflict ? 'conflict' : wd.status;
          var label = statusLabel(st);
          html += '<div class="file-row' +
            (selectedFile && selectedFile.name === f && selectedFile.zone === 'working'
              ? ' is-selected' : '') + '" data-file="' + escapeHtml(f) + '" data-zone="working">' +
            '<span class="file-dot ' + st + '">' + label[0] + '</span>' +
            '<span class="file-name">' + escapeHtml(f) + '</span>' +
            (conflict ? '<span class="file-badge">conflict</span>' : statusBadge(wd.status)) +
            '<span class="file-actions">' +
            '<button type="button" data-action="edit" data-file="' + escapeHtml(f) + '">Edit</button>' +
            '<button type="button" data-action="delete" data-file="' + escapeHtml(f) + '">Delete</button>' +
            '</span></div>';
        }
      }
    } else if (inspectorTab === 'staging') {
      var sf = Object.keys(state.staging);
      if (!sf.length) {
        html += '<div class="inspector-empty"><strong>The staging area is empty</strong>' +
          'Use <code>git add &lt;file&gt;</code> to move working-tree changes here.</div>';
      } else {
        for (var i = 0; i < sf.length; i++) {
          var name = sf[i];
          var entry = state.staging[name];
          html += '<div class="file-row' +
            (selectedFile && selectedFile.name === name && selectedFile.zone === 'staging'
              ? ' is-selected' : '') + '" data-file="' + escapeHtml(name) + '" data-zone="staging">' +
            '<span class="file-dot ' + (entry.deleted ? 'deleted' : 'staged') + '">' +
            (entry.deleted ? 'D' : '+') + '</span>' +
            '<span class="file-name">' + escapeHtml(name) + '</span>' +
            '<span class="file-badge">' + (entry.deleted ? 'deleted' : 'staged') + '</span>' +
            '</div>';
        }
      }
    } else if (inspectorTab === 'local') {
      if (!state.commits.length) {
        html += '<div class="inspector-empty"><strong>No commits yet</strong>' +
          'After <code>git add</code>, use <code>git commit -m "message"</code> to create the first snapshot.</div>';
      } else {
        var ordered = state.commits.slice().reverse();
        for (var j = 0; j < ordered.length; j++) {
          var c = ordered[j];
          var tags = [];
          if (c.hash === state.HEAD) tags.push('<span class="commit-tag head">HEAD</span>');
          for (var b in state.branches) {
            if (state.branches[b] === c.hash) {
              tags.push('<span class="commit-tag">' + escapeHtml(b) + '</span>');
            }
          }
          if (c.mergeParent) tags.push('<span class="commit-tag merge">merge</span>');
          html += '<button type="button" class="commit-row' +
            (c.hash === state.HEAD ? ' is-head' : '') + '" data-commit="' +
            escapeHtml(c.hash) + '">' +
            '<span class="commit-dot"></span>' +
            '<span class="commit-main"><span class="commit-msg">' +
            escapeHtml(c.message) + '</span>' +
            '<span class="commit-sub"><span>' + c.hash.substring(0, 7) +
            '</span>' + tags.join('') + '</span></span></button>';
        }
      }
    } else {
      var remote = state.remote || { commits: [], branches: {}, url: null };
      if (remote.url) {
        html += '<div class="remote-url">origin &nbsp;' + escapeHtml(remote.url) + '</div>';
      }
      if (!remote.commits || !remote.commits.length) {
        html += '<div class="inspector-empty"><strong>The remote is empty</strong>' +
          'Configure a remote, then push with <code>git push</code>.</div>';
      } else {
        var tips = {};
        for (var rb in remote.branches) {
          var h = remote.branches[rb];
          if (!tips[h]) tips[h] = [];
          tips[h].push(rb);
        }
        var ro = remote.commits.slice().reverse();
        for (var r = 0; r < ro.length; r++) {
          var rc = ro[r];
          var rtags = [];
          if (tips[rc.hash]) {
            for (var q = 0; q < tips[rc.hash].length; q++) {
              rtags.push('<span class="commit-tag">' + escapeHtml(tips[rc.hash][q]) + '</span>');
            }
          }
          html += '<button type="button" class="commit-row" data-commit="' +
            escapeHtml(rc.hash) + '">' +
            '<span class="commit-dot remote-dot"></span>' +
            '<span class="commit-main"><span class="commit-msg">' +
            escapeHtml(rc.message) + '</span>' +
            '<span class="commit-sub"><span>' + rc.hash.substring(0, 7) +
            '</span>' + rtags.join('') + '</span></span></button>';
        }
      }
    }
    els.inspectorBody.innerHTML = html;
    els.inspectorBody.scrollTop = keepScroll;
    renderFlow();
  }

  // ======================================================================
  // File / commit dialogs
  // ======================================================================
  function headContent(name) {
    if (!state.HEAD) return null;
    var c = state._getCommit(state.HEAD);
    if (c && c.files && c.files[name]) return c.files[name].content || '';
    return null;
  }

  function diffHtml(name, base, content) {
    if (base === content) {
      return '<span class="diff-empty">No changes</span>';
    }
    var raw = state._formatDiff(name, base == null ? '' : base, content || '');
    var lines = raw.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cls = 'd-line';
      if (/^diff --git/.test(line) || /^--- /.test(line) || /^\+\+\+ /.test(line)) {
        cls = 'd-head';
      } else if (/^@@/.test(line)) {
        cls = 'd-hunk';
      } else if (line.charAt(0) === '+') {
        cls = 'd-add';
      } else if (line.charAt(0) === '-') {
        cls = 'd-del';
      }
      out.push('<span class="' + cls + '">' + escapeHtml(line) + '</span>');
    }
    return out.join('');
  }

  function openFileDialog(name, zone) {
    currentFile = name;
    currentFileZone = zone;
    setSelection(name, zone);
    var content = '';
    var base = '';
    var editable = zone === 'working';
    if (zone === 'working') {
      var wd = state.workingDir[name];
      content = wd ? (wd.content || '') : '';
      if (state.staging[name] && !state.staging[name].deleted) {
        base = state.staging[name].content || '';
      } else {
        var hc = headContent(name);
        base = hc == null ? '' : hc;
      }
    } else {
      var entry = state.staging[name];
      content = entry ? (entry.deleted ? '' : (entry.content || '')) : '';
      var hc2 = headContent(name);
      base = hc2 == null ? '' : hc2;
    }
    els.fileTitle.textContent = name + ' · ' + zoneLabel(zone);
    els.fileDiff.innerHTML = diffHtml(name, base, content);
    els.fileEditor.value = content;
    els.fileEditor.readOnly = !editable;
    els.fileSave.hidden = !editable;
    els.fileNote.textContent = editable
      ? 'Click “Save” to write your changes back to the working directory; then run git add / git commit.'
      : 'Files in the staging area are read-only. Edit the file in the working directory and run git add again.';
    renderInspector();
    els.fileDialog.showModal();
  }

  function findRemoteCommit(hash) {
    var list = state.remote.commits || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].hash === hash) return list[i];
    }
    return null;
  }

  function openCommitDialog(hash) {
    var r = state.show(hash);
    var text;
    if (r && r.success) {
      text = r.output;
    } else {
      var c = findRemoteCommit(hash);
      text = c
        ? 'commit ' + c.hash + '\n    ' + c.message + '\n\nFiles: ' +
          Object.keys(c.files || {}).join(', ')
        : 'Commit not found: ' + hash;
    }
    els.detailsTitle.textContent = 'Commit ' + String(hash).substring(0, 7);
    els.detailsContent.textContent = text;
    els.detailsDialog.showModal();
  }

  function openHelp() {
    buildHelpCommands();
    els.helpDialog.showModal();
  }

  function promptNewFile() {
    els.promptTitle.textContent = 'New file';
    els.promptInput.value = '';
    els.promptDialog.showModal();
    setTimeout(function () { els.promptInput.focus(); }, 30);
  }

  function createFileFromPrompt() {
    var name = els.promptInput.value.trim();
    if (!name) {
      toast('Enter a file name', 'warn');
      els.promptInput.focus();
      return;
    }
    if (state.workingDir[name]) {
      toast('A file with that name already exists', 'warn');
      return;
    }
    state.createFile(name, '');
    els.promptDialog.close();
    setSelection(name, 'working');
    renderInspector();
    renderFlow();
    renderHeader();
    save();
    toast('File created', 'ok');
  }

  function deleteFile(name) {
    if (!confirm('Delete “' + name + '”? A tracked file will remain as a pending deletion.')) return;
    var r = state.deleteFile(name);
    if (r) toast(r.success ? 'File deleted' : 'Could not delete the file', r.success ? 'ok' : 'error');
    if (selectedFile && selectedFile.name === name) clearSelection();
    renderInspector();
    renderFlow();
    renderHeader();
    renderSidebar();
    save();
  }

  // ======================================================================
  // Event bindings
  // ======================================================================
  els.terminalForm.addEventListener('submit', function (e) {
    e.preventDefault();
    execute(els.terminalInput.value);
  });

  els.terminalInput.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      completeInput();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (parser.history.length && termHistoryIndex > 0) {
        termHistoryIndex--;
        els.terminalInput.value = parser.history[termHistoryIndex];
        els.terminalInput.setSelectionRange(els.terminalInput.value.length,
                                            els.terminalInput.value.length);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (termHistoryIndex < parser.history.length - 1) {
        termHistoryIndex++;
        els.terminalInput.value = parser.history[termHistoryIndex];
      } else {
        termHistoryIndex = parser.history.length;
        els.terminalInput.value = '';
      }
    }
  });

  els.chips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    els.terminalInput.value = chip.getAttribute('data-cmd');
    els.terminalInput.focus();
    els.terminalInput.setSelectionRange(els.terminalInput.value.length,
                                        els.terminalInput.value.length);
  });

  $('btn-clear').addEventListener('click', function () {
    clearTerminal();
    appendTerminalLine('Log cleared.', 't-muted');
    appendTerminalLine('', '');
    appendQuickReference();
    els.terminalInput.focus();
  });

  els.cardPrev.addEventListener('click', function () { showCard(currentCard - 1); });
  els.cardNext.addEventListener('click', function () { showCard(currentCard + 1); });

  $('brand-home').addEventListener('click', function (e) {
    e.preventDefault();
    showCard(0);
  });

  els.chapterNav.addEventListener('click', function (e) {
    var toggle = e.target.closest('.chapter-toggle');
    if (toggle) {
      var no = Number(toggle.getAttribute('data-chapter'));
      openChapters[no] = !openChapters[no];
      renderSidebar();
      return;
    }
    var cardBtn = e.target.closest('.chapter-card');
    if (cardBtn) {
      showCard(Number(cardBtn.getAttribute('data-card')));
    }
  });

  els.inspectorTabs.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    inspectorTab = tab.getAttribute('data-tab');
    renderInspector();
    save();
  });

  els.inspectorBody.addEventListener('click', function (e) {
    var actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      var fname = actionBtn.getAttribute('data-file');
      var action = actionBtn.getAttribute('data-action');
      if (action === 'delete') deleteFile(fname);
      else if (action === 'edit' && fname) openFileDialog(fname, 'working');
      return;
    }
    var commitBtn = e.target.closest('.commit-row');
    if (commitBtn) {
      openCommitDialog(commitBtn.getAttribute('data-commit'));
      return;
    }
    var row = e.target.closest('.file-row');
    if (row) {
      var file = row.getAttribute('data-file');
      var zone = row.getAttribute('data-zone');
      if (file) openFileDialog(file, zone);
    }
  });

  els.inspectorBody.addEventListener('contextmenu', function (e) {
    if (inspectorTab !== 'working' || !state.initialized) return;
    e.preventDefault();
    var row = e.target.closest('.file-row');
    contextFile = row ? row.getAttribute('data-file') : null;
    var createBtn = document.querySelector('#ctx-menu [data-action="create"]');
    var delBtn = document.querySelector('#ctx-menu [data-action="delete"]');
    createBtn.hidden = false;
    delBtn.hidden = !contextFile;
    els.ctxMenu.hidden = false;
    var x = Math.min(e.clientX, window.innerWidth - 170);
    var y = Math.min(e.clientY, window.innerHeight - 120);
    els.ctxMenu.style.left = x + 'px';
    els.ctxMenu.style.top = y + 'px';
  });

  els.ctxMenu.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var file = contextFile;
    els.ctxMenu.hidden = true;
    if (action === 'create') promptNewFile();
    else if (action === 'delete' && file) deleteFile(file);
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#ctx-menu')) els.ctxMenu.hidden = true;
  });

  $('btn-new-file').addEventListener('click', promptNewFile);
  $('btn-help').addEventListener('click', openHelp);
  $('btn-reset').addEventListener('click', function () {
    if (!confirm('Clear all practice data and start over?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    location.reload();
  });

  els.promptOk.addEventListener('click', createFileFromPrompt);
  els.promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); createFileFromPrompt(); }
  });

  els.fileSave.addEventListener('click', function () {
    if (!currentFile || currentFileZone !== 'working') return;
    var value = els.fileEditor.value;
    var old = state.workingDir[currentFile] ? state.workingDir[currentFile].content : null;
    if (old === value) {
      toast('No changes', 'warn');
      els.fileDialog.close();
      return;
    }
    if (old == null) state.createFile(currentFile, value);
    else state.modifyFile(currentFile, value);
    setSelection(currentFile, 'working');
    els.fileDialog.close();
    renderInspector();
    renderFlow();
    renderHeader();
    save();
    toast('File saved', 'ok');
  });

  // Close buttons / click the backdrop to close
  var dialogs = document.querySelectorAll('dialog');
  for (var d = 0; d < dialogs.length; d++) {
    (function (dlg) {
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) dlg.close();
      });
      var closers = dlg.querySelectorAll('[data-close]');
      for (var c = 0; c < closers.length; c++) {
        closers[c].addEventListener('click', function () { dlg.close(); });
      }
    })(dialogs[d]);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      els.ctxMenu.hidden = true;
    }
    var typing = e.target && (e.target.tagName === 'INPUT' ||
                              e.target.tagName === 'TEXTAREA');
    if (typing) return;
    if (e.key === '[') showCard(currentCard - 1);
    else if (e.key === ']') showCard(currentCard + 1);
    else if (e.key === '?') openHelp();
  });

  // ======================================================================
  // Demo / URL parameters (for screenshots and headless checks)
  // ======================================================================
  function seedDemo() {
    demoMode = true;
    noSave = true;
    completed = {};
    arrows = { add: false, commit: false, push: false,
               pull: false, clone: false, restore: false };
    state.resetAll();
    state.init();
    state.createFile('README.md', '# My First Repository\n\nThis is my first repository.');
    state.add('README.md');
    state.commit('Add README');
    state.createFile('notes.txt', 'TODO: learn add / commit / push');
    state.add('notes.txt');
    state.commit('Add notes');
    state.config_('global', 'user.name', 'demo');
    state.remote.url = 'git@github.com:demo/playground.git';
    state.push('origin', 'main');
    state.createFile('todo.md', '- Practice branching\n- Practice pull');
    state.modifyFile('README.md', '# My First Repository\n\nThis is my first repository.\n\nNow I can commit.');
    arrows.add = true;
    arrows.commit = true;
    arrows.push = true;
    currentCard = 9;
    completed[cards[9].id] = true;
  }

  var pendingRun = null;

  function applyUrlParams() {
    var params = new URLSearchParams(location.search);
    if (params.get('fresh')) {
      noSave = true;
      state.resetAll();
      completed = {};
      arrows = { add: false, commit: false, push: false,
                 pull: false, clone: false, restore: false };
      currentCard = 0;
      openChapters = { 1: true };
    }
    var demo = params.get('demo');
    if (demo) seedDemo();
    pendingRun = params.get('run');
    var card = params.get('card');
    if (card !== null && !isNaN(Number(card))) {
      currentCard = clamp(Number(card), 0, cards.length - 1);
    }
    var tab = params.get('tab');
    if (tab && ['working', 'staging', 'local', 'remote'].indexOf(tab) !== -1) {
      inspectorTab = tab;
    }
    openChapters[cards[currentCard].chapter] = true;
    if (demo) {
      // Expand the chapters around the demo card.
      openChapters[4] = true;
      openChapters[3] = true;
    }
    var dialog = params.get('dialog');
    if (dialog === 'help') openHelp();
    else if (dialog === 'file') {
      var file = params.get('file') || 'README.md';
      openFileDialog(file, 'working');
    } else if (dialog === 'commit' && state.HEAD) {
      openCommitDialog(state.HEAD);
    }
  }

  // ======================================================================
  // Startup
  // ======================================================================
  function init() {
    var restored = load();
    openChapters[cards[currentCard].chapter] = true;
    buildHelpCommands();
    applyUrlParams();
    if (!restored && !demoMode) {
      // Open the first chapter by default, plus the current chapter.
      openChapters[1] = true;
    }
    renderCard();
    renderSidebar();
    renderHeader();
    renderInspector();
    renderFlow();
    welcome();
    if (pendingRun) {
      var cmds = pendingRun.split('|');
      for (var ri = 0; ri < cmds.length; ri++) {
        var cmdText = cmds[ri].trim();
        if (cmdText) execute(cmdText);
      }
    }
    scrollTerminal();
    setTimeout(function () { els.terminalInput.focus(); }, 80);
  }

  try {
    init();
  } catch (e) {
    showError(e.message || String(e));
    if (window.console) console.error(e);
  }

  // Debug / automation entry point (also handy from the console).
  window.GitPlayground = {
    state: state,
    cards: cards,
    getCompleted: function () { return completed; },
    execute: execute,
    showCard: showCard,
    setTab: function (t) { inspectorTab = t; renderInspector(); },
    openFile: openFileDialog,
    openCommit: openCommitDialog,
    openHelp: openHelp,
    refresh: function () {
      renderFlow(); renderInspector(); renderSidebar(); renderHeader();
    },
    save: save
  };
})();
