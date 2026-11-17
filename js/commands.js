// Commands — All git command handlers
var GitTutorial = window.GitTutorial || {};

(function() {
  'use strict';

  // Helper: extract the value of a flag like -m / --message.
  // Handles `-m msg`, `-m "multi word msg"`, `-m"msg"` and `--message=msg`.
  // Only the words belonging to the message are consumed: a trailing option
  // such as `git commit -m "msg" --no-verify` must not leak into the message.
  function getMessage(args, flag) {
    for (var i = 0; i < args.length; i++) {
      var a = args[i];

      // --message=msg
      var eq = a.indexOf('=');
      if (eq !== -1 && a.substring(0, eq) === flag) {
        return a.substring(eq + 1);
      }

      if (a === flag) {
        var words = [];
        for (var j = i + 1; j < args.length; j++) {
          if (args[j].charAt(0) === '-' && args[j].length > 1) break;
          words.push(args[j]);
        }
        return words.length > 0 ? words.join(' ') : null;
      }

      // Attached form: -m"msg" / -mmsg
      if (a.length > flag.length && a.substring(0, flag.length) === flag) {
        var rest = a.substring(flag.length);
        rest = rest.replace(/^["']|["']$/g, '');
        return rest;
      }
    }
    return null;
  }

  // Expand shell-style wildcards against the working directory. The browser
  // has no real shell, so `git add *.py` would otherwise look for a literal
  // file named "*.py".
  function expandPaths(state, names) {
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (!/[*?\[]/.test(name)) { out.push(name); continue; }
      var re = new RegExp('^' + name.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                                    .replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      var found = false;
      for (var f in state.workingDir) {
        if (re.test(f)) { out.push(f); found = true; }
      }
      if (!found) out.push(name);
    }
    return out;
  }

  function nonFlagArgs(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      if (args[i].charAt(0) !== '-') out.push(args[i]);
    }
    return out;
  }

  var commands = {
    // === init ===
    'init': function(state, args) {
      return state.init();
    },

    // === clone ===
    'clone': function(state, args) {
      var url = args[0] || 'https://github.com/example/repo.git';
      return state.clone(url);
    },

    // === add ===
    'add': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git add <file>... or git add .' };
      }
      // git add -A / --all / -u behave like `add .`
      if (args[0] === '-A' || args[0] === '--all' || args[0] === '-u' ||
          (args.length === 1 && args[0] === '.')) {
        return state.add('.');
      }
      var paths = expandPaths(state, nonFlagArgs(args));
      if (paths.indexOf('.') !== -1) return state.add('.');
      // Stage every path given, not just the first.
      var stagedCount = 0;
      var errors = [];
      for (var i = 0; i < paths.length; i++) {
        var res = state.add(paths[i]);
        if (res.success) stagedCount++;
        else errors.push(res.output);
      }
      if (stagedCount === 0) {
        return { success: false, output: errors.join('\n') || 'No files to stage' };
      }
      if (errors.length > 0) {
        return { success: true, output: 'Staged ' + stagedCount + ' file(s)\n' + errors.join('\n') };
      }
      return { success: true, output: 'Staged ' + stagedCount + ' file(s)' };
    },

    // === status ===
    'status': function(state, args) {
      return state.getStatus();
    },

    // === commit ===
    'commit': function(state, args) {
      var msg = getMessage(args, '-m');
      if (!msg) msg = getMessage(args, '--message');
      if (!msg) {
        // Finishing a resolved merge may omit -m: Git supplies the default
        // merge message. Any other commit needs an explicit message.
        if (state.pendingMerge) {
          return state.commit(null);
        }
        return {
          success: false,
          output: 'Provide a commit message: git commit -m "your message"'
        };
      }
      return state.commit(msg);
    },

    // === diff ===
    'diff': function(state, args) {
      if (args.length > 0 && (args[0] === '--staged' || args[0] === '--cached')) {
        return state.diffStaged();
      }
      return state.diff(args[0]);
    },

    // === log ===
    'log': function(state, args) {
      var count = null;
      var nIdx = args.indexOf('-n');
      if (nIdx !== -1) {
        var raw = args[nIdx + 1];
        if (raw === undefined || isNaN(parseInt(raw, 10))) {
          return { success: false, output: 'fatal: -n requires an argument' };
        }
        count = parseInt(raw, 10);
      } else if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
        count = parseInt(args[0], 10);
      }
      // Unknown flags are ignored, matching git's tolerance for display flags
      // this simulator does not model (--oneline, --stat, ...).
      return state.log(count);
    },

    // === branch ===
    'branch': function(state, args) {
      if (args.length === 0) {
        return state.branch(null);
      }
      // Listing / inspection flags behave like a bare `git branch`.
      if (args[0] === '-v' || args[0] === '-a' || args[0] === '--list' ||
          args[0] === '-r' || args[0] === '-vv' || args[0] === '--all') {
        return state.branch(null);
      }
      // Handle -d (delete)
      if (args[0] === '-d' || args[0] === '-D') {
        var delName = args[1];
        if (!delName) {
          return { success: false, output: 'Usage: git branch -d <name>' };
        }
        if (delName === state.currentBranch) {
          return { success: false, output: "error: Cannot delete branch '" + delName + "' checked out" };
        }
        // Use an `in` check: a branch created before the first commit maps to
        // null and would otherwise look like a missing branch.
        if (!(delName in state.branches)) {
          return { success: false, output: "error: branch '" + delName + "' not found." };
        }
        // -d refuses to drop a branch holding commits not merged into HEAD.
        if (args[0] === '-d' && state.branches[delName] && state.HEAD) {
          var tip = state.branches[delName];
          if (!state._ancestrySet(state.HEAD)[tip]) {
            return {
              success: false,
              output: "error: The branch '" + delName + "' is not fully merged.\n" +
                      "If you are sure you want to delete it, run 'git branch -D " + delName + "'."
            };
          }
        }
        delete state.branches[delName];
        return { success: true, output: "Deleted branch " + delName + "." };
      }
      if (args[0] === '-m' || args[0] === '-M') {
        // Rename a branch. With one name, rename the current branch.
        var from = args.length >= 3 ? args[1] : state.currentBranch;
        var to = args.length >= 3 ? args[2] : args[1];
        if (!to) return { success: false, output: 'Usage: git branch -m [<old>] <new>' };
        if (!(from in state.branches)) {
          return { success: false, output: "error: branch '" + from + "' not found." };
        }
        if (to in state.branches) {
          return { success: false, output: "fatal: A branch named '" + to + "' already exists." };
        }
        state.branches[to] = state.branches[from];
        delete state.branches[from];
        if (state.currentBranch === from) state.currentBranch = to;
        return { success: true, output: "Renamed branch: " + from + " -> " + to };
      }
      // Reject anything else that starts with a dash instead of creating a
      // branch literally named "-x".
      if (args[0].charAt(0) === '-') {
        return { success: false, output: "error: unknown option '" + args[0] + "'; usage: git branch [-d|-D|-m] [<name>]" };
      }
      return state.branch(args[0]);
    },

    // === checkout ===
    'checkout': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git checkout <branch> or git checkout -b <branch>' };
      }
      if (state.mergeConflict && state.mergeConflict.length > 0) {
        return {
          success: false,
          output: 'error: you have unresolved merge conflicts. Resolve them and commit, or run git reset --hard HEAD to abort the merge.\nConflicted files: ' + state.mergeConflict.join(', ')
        };
      }
      if (args[0] === '-b') {
        if (args.length < 2) {
          return { success: false, output: 'Usage: git checkout -b <branch-name> [<start-point>]' };
        }
        if (args.length === 2) {
          return state.checkoutNewBranch(args[1]);
        }
        // `git checkout -b <name> <start-point>` — extra trailing args are ignored.
        return state.checkoutCommitNewBranch(args[1], args[2]);
      }
      if (!(args[0] in state.branches)) {
        return state.checkoutCommit(args[0]);
      }
      return state.checkout(args[0]);
    },

    // === switch ===
    'switch': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git switch <branch> or git switch -c <branch>' };
      }
      if (state.mergeConflict && state.mergeConflict.length > 0) {
        return {
          success: false,
          output: 'error: you have unresolved merge conflicts. Resolve them and commit, or run git reset --hard HEAD to abort the merge.\nConflicted files: ' + state.mergeConflict.join(', ')
        };
      }
      if (args[0] === '-c') {
        if (args.length < 2) {
          return { success: false, output: 'Usage: git switch -c <branch-name>' };
        }
        return state.switchNewBranch(args[1]);
      }
      return state.switchCmd(args[0]);
    },

    // === merge ===
    'merge': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git merge <branch>' };
      }
      if (args[0] === '--abort') {
        if (!state.pendingMerge) {
          return { success: false, output: 'error: there is no merge in progress' };
        }
        return state.reset('--hard', 'HEAD');
      }
      args = nonFlagArgs(args);
      if (args.length === 0) {
        return { success: false, output: 'Usage: git merge <branch>' };
      }
      if (state.mergeConflict && state.mergeConflict.length > 0) {
        return {
          success: false,
          output: 'error: the previous merge still has unresolved conflicts.\nConflicted files: ' + state.mergeConflict.join(', ')
        };
      }
      return state.merge(args[0]);
    },

    // === push ===
    'push': function(state, args) {
      args = nonFlagArgs(args);
      var remote = args[0] || 'origin';
      var branch = args[1] || state.currentBranch;
      return state.push(remote, branch);
    },

    // === pull ===
    'pull': function(state, args) {
      args = nonFlagArgs(args);
      var remote = args[0] || 'origin';
      var branch = args[1] || state.currentBranch;
      return state.pull(remote, branch);
    },

    // === fetch ===
    'fetch': function(state, args) {
      args = nonFlagArgs(args);
      return state.fetch(args[0]);
    },

    // === rebase ===
    'rebase': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git rebase <branch>' };
      }
      if (args[0] === '--abort') {
        if (!state.mergeConflict) {
          return { success: false, output: 'error: there is no rebase in progress' };
        }
        return state.reset('--hard', 'HEAD');
      }
      args = nonFlagArgs(args);
      if (args.length === 0) {
        return { success: false, output: 'Usage: git rebase <branch>' };
      }
      return state.rebase(args[0]);
    },

    // === stash ===
    'stash': function(state, args) {
      if (args.length === 0 || args[0] === 'save') {
        var msg = args.length > 1 ? args.slice(1).join(' ') : null;
        return state.stashSave(msg);
      }
      if (args[0] === 'pop') {
        return state.stashPop();
      }
      if (args[0] === 'apply') {
        return state.stashApply();
      }
      if (args[0] === 'list') {
        return state.stashList();
      }
      return { success: false, output: 'Usage: git stash [save|pop|apply|list]' };
    },

    // === cherry-pick ===
    'cherry-pick': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git cherry-pick <commit-hash>' };
      }
      return state.cherryPick(args[0]);
    },

    // === reset ===
    'reset': function(state, args) {
      var mode = '--mixed';
      var target = null;
      var KNOWN = { '--soft': 1, '--mixed': 1, '--hard': 1, '--keep': 1, '--merge': 1 };

      for (var i = 0; i < args.length; i++) {
        if (KNOWN[args[i]]) {
          mode = (args[i] === '--keep' || args[i] === '--merge') ? '--mixed' : args[i];
        } else if (args[i].charAt(0) === '-' && args[i].length > 1) {
          // An unrecognised option is an option error, not a revision.
          return { success: false, output: "error: unknown option `" + args[i].replace(/^--?/, '') + "'" };
        } else if (!target) {
          target = args[i];
        }
      }

      // `git reset` with no revision defaults to HEAD (unstage everything).
      if (!target) target = 'HEAD';

      return state.reset(mode, target);
    },

    // === revert ===
    'revert': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git revert <commit-hash>' };
      }
      return state.revert(args[0]);
    },

    // === tag ===
    'tag': function(state, args) {
      // `git tag` / `git tag -l` list; `-a <name> -m <msg>` creates a tag named
      // <name>; `-d <name>` deletes it.
      var name = null;
      var del = false;
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === '-l' || a === '--list') return state.tag(null);
        if (a === '-d') { del = true; continue; }
        if (a === '-a' || a === '-s' || a === '-m' || a === '--message' || a === '-f') {
          // Skip this flag and, for -m/--message, its value.
          if (a === '-m' || a === '--message') i++;
          continue;
        }
        if (a.charAt(0) === '-') continue;
        if (!name) name = a;
      }
      if (del) return state.tagDelete(name);
      return state.tag(name);
    },

    // === rm ===
    'rm': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git rm <file>... or git rm --cached <file>' };
      }
      if (args[0] === '--cached') {
        if (!args[1]) return { success: false, output: 'Usage: git rm --cached <file>' };
        return state.rmCached(args[1]);
      }
      // Remove every path given, not just the first.
      var paths = expandPaths(state, nonFlagArgs(args));
      var removed = 0;
      var errors = [];
      for (var i = 0; i < paths.length; i++) {
        var res = state.rm(paths[i]);
        if (res.success) removed++;
        else errors.push(res.output);
      }
      if (removed === 0) {
        return { success: false, output: errors.join('\n') || 'No files were deleted' };
      }
      if (errors.length > 0) {
        return { success: true, output: "rm: removed " + removed + " file(s)\n" + errors.join('\n') };
      }
      return { success: true, output: "rm: removed " + removed + " file(s)" };
    },

    // === restore ===
    'restore': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: git restore <file> | git restore --staged <file> | git restore --staged --worktree <file> | git restore --source=<rev> <file>' };
      }
      var staged = false, worktree = false, source = null, fileArg = null;
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a === '--staged' || a === '--cached') staged = true;
        else if (a === '--worktree') worktree = true;
        else if (a.indexOf('--source=') === 0) source = a.substring('--source='.length);
        else if (a === '--source' || a === '-s') { source = args[i + 1]; i++; }
        else fileArg = a;
      }
      if (!fileArg) {
        return { success: false, output: 'Usage: git restore <file>' };
      }
      if (source) {
        return state.restoreFrom(source, fileArg, staged);
      }
      if (staged && worktree) return state.restoreAll(fileArg);
      if (staged) return state.restoreStaged(fileArg);
      return state.restore(fileArg);
    },

    // === config ===
    'config': function(state, args) {
      var scope = 'local';
      var rest = [];
      for (var i = 0; i < args.length; i++) {
        if (args[i] === '--global' || args[i] === '--system') scope = 'global';
        else if (args[i] === '--local') scope = 'local';
        else if (args[i] === '--list' || args[i] === '-l') { /* list via no-key path */ }
        else rest.push(args[i]);
      }
      var value = rest.length > 1 ? rest.slice(1).join(' ') : undefined;
      return state.config_(scope, rest[0], value);
    },

    // === remote ===
    'remote': function(state, args) {
      if (args.length === 0) return state.remoteCmd(null);
      if (args[0] === '-v' || args[0] === '--verbose') return state.remoteCmd('-v');
      if (args[0] === 'add') return state.remoteCmd('add', args[1], args[2]);
      if (args[0] === 'remove' || args[0] === 'rm') return state.remoteCmd('remove', args[1]);
      if (args[0] === 'show' || args[0] === 'get-url') return state.remoteCmd('-v');
      return { success: false, output: 'Usage: git remote [add|remove|-v] <name> [<url>]' };
    },

    // === show ===
    'show': function(state, args) {
      if (args.length === 0) return { success: false, output: 'Usage: git show <commit|tag>' };
      return state.show(args[0]);
    },

    // === blame ===
    'blame': function(state, args) {
      // Tolerate `git blame -L 10,20 file` by taking the last non-flag argument.
      var file = null;
      for (var k = args.length - 1; k >= 0; k--) {
        if (args[k].charAt(0) !== '-') { file = args[k]; break; }
      }
      if (!file) return { success: false, output: 'Usage: git blame <file>' };
      return state.blame(file);
    },

    // === touch (helper: create file) ===
    'touch': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: touch <filename>' };
      }
      return state.createFile(args[0], args.length > 1 ? args.slice(1).join(' ') : '');
    },

    // === echo (helper: write content to file) ===
    'echo': function(state, args) {
      // echo "content" > filename  or  echo content >> filename
      var full = args.join(' ');
      var append = full.indexOf('>>') !== -1;
      var parts = full.split(append ? '>>' : '>');

      if (parts.length < 2) {
        return { success: false, output: 'Usage: echo "content" > <file>' };
      }

      var content = parts[0].trim().replace(/^["']|["']$/g, '');
      var filename = parts[1].trim();

      if (append && state.workingDir[filename]) {
        state.workingDir[filename].content += '\n' + content;
        if (state.workingDir[filename].status !== 'new') {
          state.workingDir[filename].status = 'modified';
        }
        return { success: true, output: 'Appended to: ' + filename };
      }

      if (state.workingDir[filename]) {
        return state.modifyFile(filename, content);
      }
      return state.createFile(filename, content);
    },

    // === cat (helper: show file content) ===
    'cat': function(state, args) {
      if (args.length === 0) {
        return { success: false, output: 'Usage: cat <file>' };
      }
      var f = state.workingDir[args[0]];
      if (!f) {
        return { success: false, output: 'File not found: ' + args[0] };
      }
      return { success: true, output: f.content };
    },

    // === help ===
    'help': function(state, args) {
      return {
        success: true,
        output: [
          'Available commands:',
          '  git init              Initialize a repository',
          '  git clone <url>       Clone a remote repository',
          '  git add <file>        Stage files (wildcards such as *.py supported)',
          '  git status            Show status',
          '  git commit -m "msg"   Commit changes',
          '  git diff              Show changes',
          '  git log               Show commit history',
          '  git branch [name]     Create / list branches',
          '  git checkout <branch> Switch branches',
          '  git switch <branch>   Switch branches (new command)',
          '  git merge <branch>    Merge a branch',
          '  git push [remote]     Push to a remote',
          '  git pull [remote]     Fetch and merge remote updates',
          '  git fetch [remote]    Fetch remote updates',
          '  git rebase <branch>   Replay commits onto another branch',
          '  git stash [save|pop|apply|list]  Shelve work',
          '  git cherry-pick <hash>  Copy a commit',
          '  git reset [mode] <commit>  Move HEAD (supports HEAD~1 / short hashes)',
          '  git revert <hash>     Revert a commit',
          '  git tag [name]        Create / list tags (-d deletes)',
          '  git rm <file>         Delete a file (--cached stops tracking only; wildcards supported)',
          '  git restore <file>    Restore a file (--staged unstages)',
          '  git config [--global] <key> [<value>]  Configure user identity',
          '  git remote [add|remove|-v] <name> [<url>]  Manage remotes',
          '  git show <commit|tag> Show commit details',
          '  git blame <file>      Trace the author of each line',
          '',
          'Helper commands:',
          '  touch <file>          Create a file',
          '  echo "content" > file Write to a file',
          '  cat <file>            Print file contents',
          '  clear                 Clear the terminal',
          '  reset-tutorial        Reset the tutorial state'
        ].join('\n')
      };
    },

    // === clear ===
    'clear': function(state, args) {
      return { success: true, output: '__CLEAR__' };
    },

    // === reset-tutorial ===
    'reset-tutorial': function(state, args) {
      state.resetAll();
      return { success: true, output: 'Tutorial state reset.' };
    }
  };

  // Expose
  GitTutorial.commands = commands;
  window.GitTutorial = GitTutorial;
})();
