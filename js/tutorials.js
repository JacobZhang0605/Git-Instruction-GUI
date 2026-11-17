// Tutorials — all tutorial card data
// ========================================
//
// Syntax reference
// ========================================
//
// 1. Structure
//    The tutorials array holds every card in order. Each card belongs to a
//    chapter (the `chapter` field); cards are grouped by that number.
//
// 2. Card fields
//    {
//      id:        'ch1-what',       // unique id: ch{chapter}-{name}
//      chapter:   1,                // chapter number (1-8)
//      title:     'What Is Git',    // card title (shown in the sidebar)
//      content:   '## Heading\n...',// body (Markdown, \n for line breaks)
//      task:      null or { prompt: '...' },
//      highlights: ['add']          // arrows to highlight after a command
//    }
//
// 3. content syntax
//    Use a template literal (backticks) for multi-line text, or join an array
//    with '\n'. Supported Markdown:
//
//    ## Heading      → <h2>
//    ### Subheading  → <h3>
//    - list item     → <li>
//    > quote         → <blockquote>
//    **bold**        → <strong>
//    `code`          → <code>
//    ```block```     → <pre><code>
//    [link](url)     → <a>
//    ![image](url)   → <img>
//
// 4. task
//    null means a knowledge-only card. A task uses { prompt: '...' }; the
//    prompt is HTML and wraps commands in <code>:
//      task: { prompt: 'Run: <code>git init</code>' }
//
// 5. highlights
//    Which arrows animate after a command. Values:
//    'add' | 'commit' | 'push' | 'pull' | 'clone' | 'restore'
//
// 6. Chapters
//    chapterNames lists chapter titles in order; the sidebar is generated
//    from the chapter numbers automatically.
//
// ========================================

var GitTutorial = window.GitTutorial || {};

(function() {
  'use strict';

  var tutorials = [
    // Chapter 1: Git fundamentals
    {
      id: 'ch1-what',
      chapter: 1,
      title: 'What Is Git',
      content: `## What Is Git

Git is a **distributed version control system**. In simple terms, it records every change you make to your files so you can return to any earlier version at any time.

**The core idea: snapshots, not differences.**

Many version control systems (such as SVN) store "what changed" each time, as a patch. Git is different: every commit saves a **snapshot of the entire project**, as if you had photographed all of your files at once.

That does not mean Git copies every file on every commit. It uses a clever design:

- Files that did not change are stored as a **reference** to the previous snapshot.
- Only files that changed are stored again with their new content.

The result is efficient storage and the ability to switch to any version instantly.

> Git's design philosophy: **everything is traceable, and everything can be undone.**`,
      task: null
    },
    {
      id: 'ch1-objects',
      chapter: 1,
      title: 'The Git Object Model',
      content: `## The Git object model: blob, tree, commit

Under the hood, Git uses three kinds of objects, stored in \`.git/objects/\`:

### blob (file content)
Stores the contents of a file. A blob is raw file data and **does not contain a file name**.

### tree (directory structure)
Stores directory information: which file names map to which blobs, and which subdirectories map to which trees.
A tree is essentially a "file name → blob" mapping.

### commit
Stores everything about one commit:
- a pointer to a tree (the project snapshot for this commit)
- a pointer to the parent commit (the previous commit)
- the author, timestamp, and commit message

\`\`\`
commit -> tree -> blob
  |
parent commit -> tree -> blob
\`\`\`

Every object is identified by a **SHA-1 hash** (for example, \`a1b2c3d\`). This is how Git guarantees data integrity: if the content changes, the hash changes.`,
      task: null
    },
    {
      id: 'ch1-areas',
      chapter: 1,
      title: 'The Four Areas',
      content: `## The four areas of Git

This is the key to understanding the Git workflow. The data flow diagram above shows the four areas, and the repository inspector on the right has one tab for each:

### 1. Working Directory
Where you actually edit files. When you change code in an editor, you are changing files in the working directory.

### 2. Staging Area / Index
A preparation area where you choose which changes go into the next commit. \`git add\` moves files into the staging area.

### 3. Local Repository
Where commit history lives. \`git commit\` packages the staging area into a snapshot and stores it in the local repository.

### 4. Remote Repository
A repository hosted on a server, such as GitHub. \`git push\` sends local commits to the remote; \`git pull\` brings remote updates down locally.

\`\`\`
Working Directory --git add--> Staging Area --git commit--> Local Repository --git push--> Remote
                                 ^                                                       |
                                 +---------------------- git pull -----------------------+
\`\`\`

> **Why the staging area exists**: it lets you control exactly which changes each commit contains, instead of committing every edit at once.`,
      task: null
    },

    // Chapter 2: Setup and configuration
    {
      id: 'ch2-init',
      chapter: 2,
      title: 'git init',
      content: `## git init — initialize a repository

\`git init\` creates a hidden \`.git\` folder in the current directory. That folder is the entire Git repository.

The \`.git\` directory contains:
- \`objects/\` — every blob, tree, and commit object
- \`refs/\` — pointers for branches and tags
- \`HEAD\` — points to the current branch
- \`index\` — the staging area
- \`config\` — repository-level configuration

After running \`git init\`, the directory is a Git repository. All version control operations from then on happen inside it.

**Try it**: run \`git init\` in the terminal and watch the data flow and the Working tab in the inspector.`,
      task: { prompt: 'Run: <code>git init</code>' },
      highlights: []
    },
    {
      id: 'ch2-config',
      chapter: 2,
      title: 'git config',
      content: `## git config — set your identity

Git needs to know who you are so it can record the author of each commit.

**Set your name and email:**
\`\`\`
git config user.name "Your Name"
git config user.email "your@email.com"
\`\`\`

**Read the current values:**
\`\`\`
git config user.name
git config user.email
\`\`\`

There are three configuration levels:
- \`--local\` (default) — applies only to this repository, stored in \`.git/config\`
- \`--global\` — applies to all repositories for this user, stored in \`~/.gitconfig\`
- \`--system\` — applies to every user on the machine

\`\`\`
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
\`\`\`

> **Recommendation**: set your name and email with \`--global\` so every new repository uses them automatically.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch2-touch',
      chapter: 2,
      title: 'Creating Files',
      content: `## Creating files

Before using Git, create a few files. These helper commands are available:

You can also right-click in the Working tab on the right and choose "New file", or right-click an existing file and choose "Delete file".

Double-click a file in the working directory to view and edit it. Files in the staging area can also be opened, but they are read-only.

**touch — create an empty file**
\`\`\`
touch readme.md
\`\`\`

**echo + > — write content**
\`\`\`
echo "hello world" > readme.md
\`\`\`
\`>\` **overwrites** the existing contents. If the file does not exist, it is created.

**echo + >> — append content**
\`\`\`
echo "second line" >> readme.md
\`\`\`
\`>>\` **appends** to the end without touching existing content.

**cat — print file contents**
\`\`\`
cat readme.md
\`\`\`
Prints the file to the terminal.

These are not Git commands, but they let you prepare files for Git to manage.

**Try it**: create a file, then write to it with echo.`,
      task: { prompt: 'First run <code>touch readme.md</code>, then <code>echo "hello world" > readme.md</code>' },
      highlights: []
    },

    // Chapter 3: Everyday basics
    {
      id: 'ch3-add',
      chapter: 3,
      title: 'git add',
      content: `## git add — stage your changes

\`git add <file>\` moves a file from the working directory into the staging area.

The staging area (index) is a concept specific to Git. It is a "pre-commit area": you choose which changes go in rather than committing all of them at once.

**Usage:**
- \`git add file.txt\` — stage one file
- \`git add .\` — stage every change
- \`git add *.js\` — stage every .js file

After running \`git add\`, look at the repository inspector on the right: the file should move from Working to Staging.

> \`git add\` does not create a commit. It only prepares files. You can add several times and commit once.`,
      task: { prompt: 'Run: <code>git add readme.md</code>' },
      highlights: ['add']
    },
    {
      id: 'ch3-status',
      chapter: 3,
      title: 'git status',
      content: `## git status — inspect the current state

\`git status\` shows the current state of the working directory and the staging area.

It tells you:
- which files are **staged** (ready to commit)
- which files are **modified but not staged**
- which files are **untracked** (new files Git does not know about yet)

This is one of the most frequently used commands. When you are unsure what is going on, run \`git status\` first.

**Try it**: after creating a file, run \`git status\` and read the output.`,
      task: { prompt: 'Run: <code>git status</code>' },
      highlights: []
    },
    {
      id: 'ch3-diff',
      chapter: 3,
      title: 'git diff',
      content: `## git diff — review changes

\`git diff\` shows the actual edits in your files, line by line, so you can see **what changed**.

**Two common forms:**
- \`git diff --staged\` — compare the **staging area against the last commit** to see what you have added
- \`git diff\` — compare the **working directory against the staging area** to see edits you have not added yet

Output format (note that there is **no space** after \`+\` or \`-\`):
\`\`\`
-hello world       (old line, removed)
+Hello Git         (new line, added)
\`\`\`

You have already added readme.md. Try \`git diff --staged\` to see what is in the staging area.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch3-commit',
      chapter: 3,
      title: 'git commit',
      content: `## git commit — record a snapshot

\`git commit -m "message"\` packages the staging area into a commit and stores it in the local repository.

A commit is a snapshot of the project: it records the state of every file at that moment.

The message should briefly describe what you did:
\`\`\`
git commit -m "Add readme file"
\`\`\`

After committing, check the Local tab on the right. Your first commit is there.

> Every commit records which files changed, what changed, and which commit came before. Together they form a complete history chain.`,
      task: { prompt: 'Run: <code>git commit -m "Add readme"</code>' },
      highlights: ['commit']
    },
    {
      id: 'ch3-log',
      chapter: 3,
      title: 'git log',
      content: `## git log — view commit history

\`git log\` lists commits from newest to oldest. A real output looks like this:

\`\`\`
commit a1b2c3d (HEAD -> main)
Author: Your Name <your@email.com>
Date:   Mon Jun 2 10:00:00 2025

    Add readme
\`\`\`

\`HEAD -> main\` means HEAD currently points at the latest commit on main. HEAD records "which commit you are on"; when you switch branches, HEAD moves with you.

**Useful options:**
- \`git log -n 3\` — show only the three most recent commits
- \`git log --oneline\` — compact output, one line per commit

Try it: your recent commit should now appear in the history.`,
      task: { prompt: 'Run: <code>git log</code>' },
      highlights: []
    },
    {
      id: 'ch3-restore',
      chapter: 3,
      title: 'git restore',
      content: `## git restore — restore files

\`git restore\` is dedicated to restoring file contents. Data moves between three places: the **working directory**, the **staging area**, and **commit history (HEAD)**.

**Case 1: discard working-directory edits (most common)**
\`\`\`
git restore readme.md
\`\`\`
Restores the working-directory file to the version in the **staging area**. If it was never staged, it restores the version from the last commit.

**Case 2: unstage (undo git add)**
\`\`\`
git restore --staged readme.md
\`\`\`
Removes the file from the staging area but **does not** change the code you wrote in the working directory.

**Case 3: discard both staged and working-directory changes**
\`\`\`
git restore --staged --worktree readme.md
\`\`\`
Abandons every change to this file and returns it to the last commit.

**Case 4: restore a file from history**
\`\`\`
git restore --source=HEAD~1 readme.md
\`\`\`
Pulls the file from the previous commit into the working directory.
> Note: \`HEAD\` is the latest commit, \`HEAD~1\` is its parent, \`HEAD~2\` is two commits back, and so on.`,
      task: { prompt: 'Run <code>git restore readme.md</code>' },
      highlights: ['restore']
    },
    {
      id: 'ch3-checkout-file',
      chapter: 3,
      title: 'git checkout Hash',
      content: `## git checkout Hash


      Switch to the specified commit.

      This puts you in a detached HEAD state. Avoid editing files from this state. It is mainly useful for inspecting the contents of an older commit.`,
      task: null
    },

    // Chapter 4: Branching
    {
      id: 'ch4-branch',
      chapter: 4,
      title: 'git branch',
      content: `## git branch — manage branches

Branches are one of Git's most powerful features.

**What is a branch?**
A branch is simply a label pointing at a commit. Creating one adds a label and is effectively instant.

**Usage:**
- \`git branch\` — list branches
- \`git branch dev\` — create a branch named dev
- \`git branch -d dev\` — delete a branch

When you create a branch, it points at the current commit. Both branches share the history up to that point and then diverge.

\`\`\`
main:    A -- B -- C
                    \\
dev:                 D -- E
\`\`\`

**Try it**: create a \`dev\` branch.`,
      task: { prompt: 'Run: <code>git branch dev</code>' },
      highlights: []
    },
    {
      id: 'ch4-checkout',
      chapter: 4,
      title: 'git checkout',
      content: `## git checkout — switch branches

\`git checkout <branch>\` switches to the specified branch.

When you switch branches, Git:
1. points HEAD at the new branch
2. updates the working directory to match that branch's latest commit

**Create and switch in one step:**
\`git checkout -b dev\` — create the dev branch and switch to it immediately

After switching, your working directory contains the dev branch's content. The two branches can evolve independently without affecting each other.

\`git checkout -b dev Hash\` — create dev at a specific commit and switch to it

You can also start a branch from a historical commit. The branches diverge from that point.

**Try it**: switch to the dev branch.`,
      task: { prompt: 'Run: <code>git checkout dev</code>' },
      highlights: []
    },
    {
      id: 'ch4-checkout-history',
      chapter: 4,
      title: 'A Bit of Git History',
      content: `## A bit of Git history: checkout, switch, and restore

In early Git, \`git checkout\` did too many things. Its core idea was "take something out and put it in the working directory", which caused a great deal of conceptual confusion:

1. **Branch operations**: \`git checkout dev\` (switch branches)
2. **File operations**: \`git checkout -- readme.md\` (discard edits, restore a file)

**The split (introduced in Git 2.23)**:
To make commands self-explanatory, the Git community divided \`checkout\` into two focused commands:

- **\`git switch\`**: switch branches.
- **\`git restore\`**: restore files (it also took over unstaging, which previously used \`reset HEAD\`).

The old \`checkout\` still works, but modern Git tutorials strongly recommend \`switch\` and \`restore\`.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch4-switch',
      chapter: 4,
      title: 'git switch',
      content: `## git switch — switch branches (new command)

\`git switch\` was introduced in Git 2.23 to replace the branch-switching part of \`git checkout\`.

Why? Because \`git checkout\` has too many responsibilities (switching branches, restoring files, creating branches...) and is easy to confuse.

**Usage:**
- \`git switch main\` — switch to main
- \`git switch -c feature\` — create and switch to feature

Mapping from \`git checkout\`:
- \`git checkout dev\` → \`git switch dev\`
- \`git checkout -b dev\` → \`git switch -c dev\`

**Try it**: switch back to main.`,
      task: { prompt: 'Run: <code>git switch main</code>' },
      highlights: []
    },
    {
      id: 'ch4-merge',
      chapter: 4,
      title: 'git merge',
      content: `## git merge — combine branches

\`git merge <branch>\` merges the changes from a branch into the current branch.

The usual pattern is to switch to the target branch (often main) and then merge the other branch:
\`\`\`
git switch main
git merge dev
\`\`\`

**Two ways a merge can happen:**

### Fast-forward
If main has no new commits and dev is ahead, Git only needs to move main to dev's position:
\`\`\`
before:  main ── A
                \\
         dev      B ── C

after:   main ── A ── B ── C
\`\`\`

### Three-way merge
If main and dev both have new commits, Git finds the common ancestor, combines both sets of changes, and creates a merge commit:
\`\`\`
         main ── A ── B ── M
                       /
         dev     C ── D

M is the merge commit; it has two parents (B and D).
\`\`\`

Switch to dev, create a new file, commit it, then switch back to main and merge dev.`,
      task: { prompt: 'Try: switch to dev (<code>git switch dev</code>), create a file and commit, then switch back to main and merge' },
      highlights: ['commit']
    },
    {
      id: 'ch4-conflict',
      chapter: 4,
      title: 'Merge Conflicts',
      content: `## Merge conflicts

When two branches change the same part of the same file, Git cannot merge automatically. This produces a **conflict**.

Conflict markers look like this:
\`\`\`
<<<<<<< HEAD
content from the current branch
=======
content from the branch being merged
>>>>>>> dev
\`\`\`

How to resolve a conflict:
1. Open the conflicted file and find the \`<<<<<<<\` marker
2. Decide which side to keep (or combine both)
3. Delete the conflict markers
4. \`git add\` the file to mark it resolved
5. \`git commit\` to complete the merge

> Conflicts are not scary. Git is simply saying: "I cannot merge these two changes automatically; you decide."`,
      task: null
    },

    // Chapter 5: Remote collaboration
    {
      id: 'ch5-ssh',
      chapter: 5,
      title: 'SSH Keys',
      content: `## SSH keys — authenticate with a remote

To communicate with GitHub and other remote repositories, you need to prove who you are. SSH keys are the most common method.

**How it works:**
- You generate a key pair: a **private key** (kept locally) and a **public key** (uploaded to GitHub)
- GitHub uses the public key to verify your identity; you sign with the private key

**Step 1: generate a key**
\`\`\`
ssh-keygen -t rsa -C "your@email.com"
\`\`\`
Press Enter through the prompts. The key is created at \`~/.ssh/id_rsa\` by default.

**Step 2: copy the public key**
\`\`\`
cat ~/.ssh/id_rsa.pub
\`\`\`
Copy the entire output.

**Step 3: add it to GitHub**
GitHub → Settings → SSH and GPG keys → New SSH key → paste the public key

**Step 4: test the connection**
\`\`\`
ssh -T git@github.com
\`\`\`
Seeing \`Hi username!\` means the setup succeeded.

> Once SSH is configured, clone/push/pull can use URLs like \`git@github.com:username/repo.git\` without a password each time.`,
      task: null
    },
    {
      id: 'ch5-remote',
      chapter: 5,
      title: 'Remotes and push',
      content: `## Remotes and git push

A remote is a Git repository hosted on a server, such as GitHub. Your local repository synchronizes with it through push and pull.

**Add a remote:**
\`\`\`
git remote add origin git@github.com:user/repo.git
\`\`\`
\`origin\` is the conventional name for the default remote, but you can choose another. To list configured remotes:
\`\`\`
git remote -v
\`\`\`

**Push to the remote:**
\`\`\`
git push origin main
\`\`\`
This sends the commits on your local main branch to the remote. They will then be visible on GitHub.

Try pushing your earlier commits to the remote.`,
      task: { prompt: 'Run: <code>git push origin main</code>' },
      highlights: ['push']
    },
    {
      id: 'ch5-reset-tutorial',
      chapter: 5,
      title: 'Reset the Tutorial',
      content: `## Reset the tutorial

You have learned local Git operations and remote push. Next we will change scenarios: **cloning a project from a remote**.

To simulate that, reset the tutorial state first:
\`\`\`
reset-tutorial
\`\`\`
This is a helper command. It clears all current data and returns to the initial state.

After resetting, the next card will clone an example repository.`,
      task: { prompt: 'Run: <code>reset-tutorial</code>' },
      highlights: []
    },
    {
      id: 'ch5-clone',
      chapter: 5,
      title: 'git clone',
      content: `## git clone — copy a repository

\`git clone <url>\` copies a complete project from a remote repository to your machine:
\`\`\`
git clone git@github.com:user/repo.git
\`\`\`

It will:
1. download all remote content
2. create a local repository and working directory
3. check out the default branch (usually main)
4. configure the remote URL as \`origin\` automatically

When the clone finishes, you have the complete project history, identical to the remote. That is what "distributed" means: everyone's local copy is a full repository.

Two URL formats:
- HTTPS: \`https://github.com/user/repo.git\`
- SSH: \`git@github.com:user/repo.git\` (requires an SSH key)

Try cloning an example repository:`,
      task: { prompt: 'Run: <code>git clone git@github.com:user/repo.git</code>' },
      highlights: ['clone']
    },
    {
      id: 'ch5-fetch',
      chapter: 5,
      title: 'git fetch',
      content: `## git fetch — fetch remote updates

Before using fetch, configure a remote URL:
\`\`\`
git remote add origin git@github.com:user/repo.git
git fetch origin
\`\`\`

fetch downloads new commits from the remote but **does not merge** them into your working directory. It only updates your local record of the remote (such as \`origin/main\`), so you can see what changed remotely without modifying your files.

\`\`\`
before fetch:  local main → C,   remote main → E
after fetch:   local main → C,   origin/main → E
               (you are still on C, but now know E exists)
\`\`\`

> \`git pull\` = \`git fetch\` + \`git merge\`. When you want precise control, fetch first and decide whether to merge.

Try fetching, then run \`git status\` to see what changed.`,
      task: { prompt: 'Run: <code>git fetch origin</code>' },
      highlights: []
    },
    {
      id: 'ch5-pull',
      chapter: 5,
      title: 'git pull',
      content: `## git pull — fetch and merge

Before pulling, configure a remote URL if you have not already:
\`\`\`
git remote add origin git@github.com:user/repo.git
git pull origin main
\`\`\`
\`origin\` is the remote name and \`main\` is the branch. By default, \`git pull\` = \`git fetch\` + \`git merge\`.

pull downloads commits from the remote, merges the branch into your local repository, and then updates the working directory. In day-to-day work, running \`git pull\` before you start is a good habit.

\`\`\`
local:   A -- B -- C
remote:  A -- B -- D -- E

after pull: A -- B -- C -- M (merge commit)
                   \\      /
                    D -- E
\`\`\`

### Aside: merging pull requests on GitHub
After pushing code and opening a pull request, GitHub offers three common merge options:
1. **Create a merge commit**: keeps all commit history and adds a merge commit (like M above). Best when the full development history matters.
2. **Squash and merge**: combines your commits into one new commit on the main branch. The cleanest history; good for small features.
3. **Rebase and merge**: replays your commits one by one onto the tip of the main branch, with no merge commit. The history stays linear.

At this point you know the core Git workflow:
**add → commit → push & pull**

These four commands cover the vast majority of everyday work. The remaining chapters are advanced material; practice them when you need them.`,
      task: { prompt: 'Run: <code>git pull origin main</code>' },
      highlights: []
    },

    // Chapter 6: Undoing changes
    {
      id: 'ch6-reset',
      chapter: 6,
      title: 'git reset',
      content: `## git reset — move HEAD

\`git reset\` undoes commits by moving the HEAD pointer. It has three modes, which differ in how they treat the staging area and working directory:

### --soft
Moves HEAD back to an older commit. Everything you "removed" stays in the **staging area**.
Useful for: splitting or combining commits, or rewriting a bad commit message.

### --mixed (default)
Moves HEAD back and also **resets the staging area** to match. The working directory is untouched.
Useful for: undoing a commit and its \`git add\` while keeping the files, ready for you to reorganize.

### --hard
Moves HEAD and forcibly resets both the staging area and the **working directory**.
**This is destructive: uncommitted changes are lost permanently.**
Useful for: discarding the current work entirely and returning to a clean older state.

\`\`\`
git reset --soft HEAD~1   # undo the commit only
git reset --mixed HEAD~1  # undo the commit and the add (default)
git reset --hard HEAD~1   # discard everything and move HEAD back
\`\`\``,
      task: null,
      highlights: []
    },
    {
      id: 'ch6-revert',
      chapter: 6,
      title: 'git revert',
      content: `## git revert — undo a commit safely

\`git revert <commit-hash>\` creates a new commit whose content reverses the specified commit.

How it differs from \`reset\`:
- \`reset\` **deletes** history (rewrites existing commits)
- \`revert\` **adds** history (creates an inverse commit)

\`\`\`
original:     A -- B -- C
revert B:     A -- B -- C -- B'
                        (B' reverses what B changed)
\`\`\`

> **Golden rule**: if a commit has been pushed and others may be using it, **use revert, not reset**. Resetting rewrites history and can break other people's code.`,
      task: null,
      highlights: []
    },

    // Chapter 7: Advanced tools
    {
      id: 'ch7-rebase',
      chapter: 7,
      title: 'git rebase',
      content: `## git rebase — replay commits

\`git rebase main\` replays the current branch's commits one by one onto the latest commit on main.

**rebase vs merge:**

Suppose dev has two commits (D, E) and main has new commits (B, C):

Merging:
\`\`\`
main:  A ── B ── C ── M   (M is a merge commit with two parents)
              \\      /
dev:           D ── E
\`\`\`
History keeps the fork, plus an extra merge commit M.

Rebasing:
\`\`\`
main:  A ── B ── C
                 \\
dev:              D' ── E'   (D' and E' are copies with new hashes)
\`\`\`
History becomes a straight line with no merge commit.

At its core, rebase takes your commits off the branch and reapplies them at the tip of the target branch, like grafting.

> **Golden rule**: **do not rebase commits that have been pushed to a remote!** Rebase rewrites hashes and can break other people's history. Rebase only local commits before pushing.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch7-stash',
      chapter: 7,
      title: 'git stash',
      content: `## git stash — set work aside

\`git stash\` hides changes from the working directory and staging area, leaving the working directory clean.

Scenario: you are halfway through a feature branch when you urgently need to switch to main to fix a bug, but your work is not ready to commit. stash solves that.

**Usage:**
- \`git stash\` — save the current changes
- \`git stash list\` — list all stashes
- \`git stash pop\` — restore the most recent stash and delete it
- \`git stash apply\` — restore it but keep the stash entry

\`\`\`
git stash          # set aside
git switch main    # fix the bug on main
git switch feature # come back
git stash pop      # restore the previous work
\`\`\``,
      task: null,
      highlights: []
    },
    {
      id: 'ch7-worktree',
      chapter: 7,
      title: 'git worktree',
      content: `## git worktree — multiple working directories

Normally a Git repository can check out only one branch into its working directory at a time. \`git worktree\` lets you create **multiple parallel working directories** for the **same local repository**.

**The problem it solves:**
You have written a lot of code on \`feature\` and your local environment is running. Suddenly you need to switch to \`main\` to fix an urgent bug.
- Switching directly? Git refuses because of many uncommitted changes.
- Stashing first? Switching branches can invalidate dependencies and build artifacts, which is painful.

**The worktree solution:**
Leave the current directory exactly as it is, and create a new directory beside it to fix the bug. Both share the same Git database underneath.

\`\`\`
# Create a new directory named hotfix outside this repository and check out main
git worktree add ../hotfix main

# After fixing and committing the bug, clean up the temporary directory
git worktree remove ../hotfix
\`\`\`
It is fast, saves space, fully isolates the environment, and protects your flow.

> This simulator does not model multiple directories; the commands are included for reference.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch7-cherry-pick',
      chapter: 7,
      title: 'git cherry-pick',
      content: `## git cherry-pick — copy one commit

\`git cherry-pick <commit-hash>\` extracts the **changes (diff)** introduced by a commit and reapplies them on the current branch.

Scenario: you fixed a bug on dev (commit D) but do not want to merge all of dev; you only need that fix on main.

\`\`\`
dev:   A ── B ── C ── D    (D changed line 10 of login.py)
main:  A ── B

git switch main
git cherry-pick D
main:  A ── B ── D'         (D' also changes line 10 of login.py)
\`\`\`

cherry-pick copies "what changed", not a file snapshot, and reapplies it at the current position. D' and D therefore have different hashes but the same changes.

> Note: this copies changes rather than moving them. D still exists on dev.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch7-tag',
      chapter: 7,
      title: 'git tag',
      content: `## git tag — label releases

Tags mark release versions (v1.0, v2.0, ...) so you can find them quickly later.

A tag, like a branch, points at a commit. The difference:
- a **branch** moves forward as new commits land
- a **tag** stays fixed at the commit it was created on

\`\`\`
git tag v1.0              # tag the current commit
git tag                   # list all tags
git show v1.0             # show the tagged commit
git tag -d v1.0           # delete a tag
\`\`\`

A lightweight tag (as above) is just a label. There are also **annotated tags** (\`git tag -a v1.0 -m "message"\`), which include the author and a description and are better for formal releases.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch7-rm',
      chapter: 7,
      title: 'git rm',
      content: `## git rm — delete files

\`git rm <file>\` deletes a file from both the working directory and the staging area, and records the deletion. Commit afterwards.

\`\`\`
git rm readme.md       # delete the file + stage the deletion
git commit -m "Remove readme"
\`\`\`

Compared with deleting a file manually:
- after a manual delete, you must run \`git add\` so Git knows about it
- \`git rm\` does both in one step: delete + stage

To stop tracking a file but keep it on disk:
\`\`\`
git rm --cached <file>
\`\`\`
Useful when a file such as \`.env\` was added by mistake and should no longer be tracked.`,
      task: null,
      highlights: []
    },
    {
      id: 'ch7-blame',
      chapter: 7,
      title: 'git blame',
      content: `## git blame — trace changes

\`git blame <file>\` shows the last author and commit for each line of a file.

Output format:
\`\`\`
a1b2c3d (Alice 2025-01-15) def login():
b2c3d4e (Bob   2025-02-01)     check_token()
\`\`\`
Each line is prefixed with the commit hash, author, date, and content.

Use it to find out who changed a line and why. Combined with \`git log\` and \`git show\`, it gives the full context.

\`\`\`
git blame login.py         # whole file
git blame -L 10,20 login.py  # only lines 10-20
\`\`\``,
      task: null,
      highlights: []
    },

    // Chapter 8: Workflow overview
    {
      id: 'ch8-workflow',
      chapter: 8,
      title: 'A Typical Day',
      content: `## A typical Git workday

A standard day with Git:

\`\`\`
# 1. Pull the latest code
git pull origin main

# 2. Create a feature branch
git switch -c feature/login

# 3. Develop and commit
git add .
git commit -m "Add login form"

# 4. Push to the remote
git push origin feature/login

# 5. Open a pull request (on GitHub)

# 6. After review, merge into main

# 7. Switch back to main and pull the latest
git switch main
git pull origin main

# 8. Delete the feature branch
git branch -d feature/login
\`\`\`

The core loop is: **edit → add → commit → push → PR → merge**`,
      task: null
    },
    {
      id: 'ch8-gitflow',
      chapter: 8,
      title: 'Git Flow',
      content: `## The Git Flow workflow

Git Flow is a popular branching strategy:

- **main** — always production-ready
- **develop** — the main development line
- **\`feature/*\`** — feature branches, cut from develop
- **\`release/*\`** — release preparation branches
- **\`hotfix/*\`** — urgent fixes

\`\`\`
main:     A --------- M --------- R
           \\         ^           ^
dev:        D -- F -- D -- F --- D
               ^    ^
feature:      f1   f2
\`\`\`

Small teams may not need all this. A simpler policy:
- keep main deployable
- one branch per feature
- merge through pull requests

> Choose the workflow that fits your team. Do not add process for its own sake.`,
      task: null
    }
  ];

  // Build chapters from the flat list
  var chapters = [];
  var chapterNames = [
    'Git Fundamentals',
    'Setup and Configuration',
    'Everyday Basics',
    'Branching',
    'Remote Collaboration',
    'Undoing Changes',
    'Advanced Tools',
    'Workflows'
  ];

  for (var i = 0; i < chapterNames.length; i++) {
    var ch = {
      title: chapterNames[i],
      cards: []
    };
    for (var j = 0; j < tutorials.length; j++) {
      if (tutorials[j].chapter === i + 1) {
        ch.cards.push(tutorials[j]);
      }
    }
    chapters.push(ch);
  }

  // Expose
  GitTutorial.tutorials = tutorials;
  GitTutorial.chapters = chapters;
  window.GitTutorial = GitTutorial;
})();
