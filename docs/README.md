# Mobile App Development — Prototype Starter

Use this repository to build, test, and submit your React Native prototype.

By the end of this process, you will have:

- Forked the class repository
- Cloned your fork to your computer
- Created an Expo React Native app
- Run the app locally
- Saved your work with Git
- Submitted a pull request for grading

> [!TIP]
> ## Use AI when you get stuck
>
> You are encouraged to ask [U-M GPT](https://umgpt.umich.edu/) or another approved AI assistant to explain errors and help you troubleshoot.
>
> Never share passwords, access tokens, API keys, or other private information with an AI assistant.

---

## 0. Prerequisites

Complete these items before beginning.

### Accounts

You will need:

- A [GitHub account](https://github.com/) 
- To be logged into expo -  [go to Expo snack](https://snack.expo.dev/) and choose "Log in" if you aren't already and authenticate with your Umich Google account. 


### Software

You will need:

- [Git](https://git-scm.com/downloads)
- [nvm](https://github.com/nvm-sh/nvm), the Node Version Manager (easy way to get to the needed version, currently the minimum is  20.19.4 )
  - Windows users may use [nvm-windows](https://github.com/coreybutler/nvm-windows)
- A code editor:
  - [Visual Studio Code](https://code.visualstudio.com/)
  - [WebStorm](https://www.jetbrains.com/webstorm/)
  - Students can apply for a free [JetBrains educational license](https://www.jetbrains.com/community/education/#students)
- [Expo Go](https://expo.dev/go) on your iOS or Android device

Check your setup by opening a terminal and running:

```bash
git --version
nvm --version
node --version
npm --version
```

Each command should print a version number.

> [!IMPORTANT]
> You probably already have Node.js installed. Do not reinstall Node.js just because you encounter an error. Reinstalling it may create conflicts with your existing setup.
>
> Use `nvm` to manage Node versions. If you are uncertain, ask an AI assistant or your instructor before changing your Node installation.

### GitHub authentication

GitHub may ask you to authenticate when you clone or push.

See [GitHub's authentication documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github) for setup instructions. An AI assistant can also guide you through the steps for your operating system.

Never share your password, personal access token, or SSH private key with anyone—including an AI assistant.

---

## 1. Fork the Class Repository

A **fork** is your own copy of the class repository on GitHub.

1. Open the class repository in GitHub.
2. Select **Fork** in the upper-right corner.
3. Keep the suggested repository name unless your assignment says otherwise.
4. Select **Create fork**.

After GitHub finishes, confirm that the repository appears under your GitHub username.

Your fork's URL should look like this:

```text
https://github.com/YOUR-GITHUB-USERNAME/REPOSITORY-NAME
```

---

## 2. Clone Your Fork

A **clone** is a copy of the repository on your computer.

On your fork's GitHub page:

1. Select the green **Code** button.
2. Select **HTTPS**.
3. Copy the repository URL.
4. Open a terminal.
5. Move to the folder where you keep class projects.
6. Run the following commands, replacing the placeholders with your information:

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/REPOSITORY-NAME.git
cd REPOSITORY-NAME
```

Confirm that you cloned your own fork:

```bash
git remote -v
```

The `origin` URLs should contain your GitHub username.

> [!TIP]
> **AI prompt idea**
>
> ```text
> I am using OPERATING-SYSTEM and trying to clone my GitHub fork.
> Please guide me one step at a time. Do not ask me to share passwords
> or access tokens.
>
> Here is the command I ran:
> COMMAND
>
> Here is the complete error:
> ERROR-MESSAGE
> ```

---

## 3. Create the Expo App

This starter repository intentionally does not contain a `package.json` or an Expo application. You will generate the application files yourself.

Make sure your terminal is inside the cloned repository:

```bash
pwd
```

On Windows PowerShell, you can also use:

```powershell
Get-Location
```

Then create a blank Expo application inside the current repository:

```bash
npx create-expo-app@latest . --template blank
```

The `.` means “create the Expo app in the current folder.”

If you are asked whether packages may be installed, enter `y`.

If it asks what SDK version you want to install, choose the version that matches the most recent Expo Go on your phone if available, 
otherwise the most recent. Note that you can often install newer Expo Go versions than App Store or Play via https://expo.dev/go 

It should ask you ` You are creating a project inside of an existing Git repository. Skip initializing a new git repository?` - say `Y` for yes.

> [!IMPORTANT]
> Run this command only once. Do not run it again after you have started building your prototype unless your instructor specifically tells you to do so.

When the command finishes, confirm that the repository now contains files such as:

```text
package.json
App.js
```

The exact files may vary depending on the current Expo template.

> [!TIP]
> **AI prompt idea**
>
> ```text
> I ran the following command inside a cloned GitHub repository:
>
> npx create-expo-app@latest . --template blank
>
> Operating system: OPERATING-SYSTEM
> Node version: NODE-VERSION
> npm version: NPM-VERSION
>
> Complete error:
> ERROR-MESSAGE
>
> Explain the likely cause in beginner-friendly language and give me
> one troubleshooting step at a time. Do not tell me to reinstall Node
> unless you first explain why that is necessary.
> ```

---

## 4. Your Branch

You can stick with the main branch for your PR

Commit the current changes

```bash
git add .
git commit -m "Expo Init"
```

---

## 5. Run the App Locally

Start the Expo development server:

```bash
npx expo start
```

A QR code and development menu should appear.

### Run on a physical device

1. Connect your computer and phone to the same network when possible.
2. Open **Expo Go** on your phone.
3. Scan the QR code shown by Expo.

On iOS, you may need to scan the QR code with the Camera app.

### Run in a simulator or emulator

From the Expo terminal:

- Press `a` to open an Android emulator.
- Press `i` to open an iOS Simulator.
- Press `i` to open a web Simulator.


The iOS Simulator requires macOS and Xcode. The Android emulator requires Android Studio and an emulator configured in advance.

### If your phone cannot connect

Stop the Expo server by pressing `Ctrl+C`, and then try tunnel mode:

```bash
npx expo start --tunnel
```

> [!TIP]
> **AI prompt idea**
>
> ```text
> My Expo React Native app will not open in Expo Go.
>
> Operating system: OPERATING-SYSTEM
> Phone: PHONE-TYPE
> Command: npx expo start
>
> What I expected:
> EXPECTED-RESULT
>
> What happened:
> ACTUAL-RESULT
>
> Complete terminal error:
> ERROR-MESSAGE
>
> Help me diagnose this one step at a time.
> ```

---

## 6. Build Your Prototype

Edit the starter application according to the assignment instructions.

Your main component will usually be:

```text
App.js
```

Depending on your Expo template and course instructions, the project may use different files.

Keep the Expo terminal running while you work. Expo should automatically update the preview after you save a file.

Check your Git changes periodically:

```bash
git status
```

---

## 7. Save Your Work with Git

When you reach a useful checkpoint, save your changes:

```bash
git add .
git commit -m "YOUR-MESSAGE"
```

Replace `YOUR-MESSAGE` with a short description of what you changed.

For example:

```bash
git commit -m "Add prototype home screen"
```

Push your branch to your GitHub fork:

```bash
git push -u origin BRANCH-NAME
```

Replace `BRANCH-NAME` with the branch name you created earlier.

After the first push, you can upload later commits with:

```bash
git add .
git commit -m "YOUR-MESSAGE"
git push
```

Good commit messages briefly describe what changed:

```text
Add prototype navigation
Create profile screen layout
Fix button spacing
Update colors and typography
```

> [!TIP]
> **AI prompt idea**
>
> ```text
> I received an error while committing or pushing my work with Git.
>
> Current branch:
> BRANCH-NAME
>
> Command:
> COMMAND
>
> Complete error:
> ERROR-MESSAGE
>
> Explain the error in beginner-friendly language. Give me one safe
> troubleshooting step at a time. Do not suggest force-pushing unless
> you explain the risks first.
> ```

---


## 8. Open a Pull Request

A **pull request**, or PR, asks the instructor to review your work.

> [!IMPORTANT]
> Your assignment may require a specific pull-request name. Check the assignment instructions before naming or submitting your pull request.

1. Make sure your latest changes have been committed and pushed.
2. Open your fork on GitHub.
3. Switch to `BRANCH-NAME` if necessary.
4. Select **Contribute** and then **Open pull request**.
5. Check the repository and branch information carefully.

The pull request should usually show:

```text
base repository: ORIGINAL-CLASS-REPOSITORY
base branch: main

head repository: YOUR-GITHUB-USERNAME/YOUR-FORK
compare branch: BRANCH-NAME
```

6. Enter the pull-request name required by the assignment. If no name is specified, use a short, descriptive name.
7. Complete the pull-request description.
8. Select **Create pull request**.

### Pull-request description

Copy and complete this template:

```markdown
## Prototype summary

PROTOTYPE-DESCRIPTION



## How to test

1. TESTING-STEP
2. TESTING-STEP
3. EXPECTED-RESULT

## Known issues

KNOWN-ISSUES

## AI use

DESCRIPTION-OF-AI-USE
```

If there are no known issues, write:

```text
None known.
```

> [!TIP]
> **AI prompt idea**
>
> ```text
> Explain step-by-step how to open a pull request from BRANCH-NAME
> in my GitHub fork to the main branch of the original class repository.
>
> Also explain how I can verify the base repository, base branch,
> head repository, and compare branch before submitting.
> ```

---

## 9. Final Submission Checklist

Before submitting, confirm that:

- [ ] I used the branch name required by the assignment
- [ ] The app runs locally with `npx expo start`
- [ ] `git status` does not show important uncommitted changes
- [ ] My latest commits were pushed to GitHub
- [ ] My repository does not contain passwords, tokens, or API keys

- [ ] The pull request points to the original class repository
- [ ] The pull request compares `BRANCH-NAME` against the correct base branch
- [ ] The pull request has the name required by the assignment
- [ ] The pull-request description includes my Expo Snack URL
- [ ] I listed any known issues

To check your current Git status and branch, run:

```bash
git status
git branch --show-current
```

---

## General AI Troubleshooting Prompt

When asking AI for technical help, provide enough context to understand the problem:

```text
I am a student working on an Expo React Native project.

Goal:
YOUR-GOAL

Environment:
- Operating system: OPERATING-SYSTEM
- Node version: NODE-VERSION
- npm version: NPM-VERSION
- Expo version, if known: EXPO-VERSION
- Device or emulator: DEVICE-DESCRIPTION

Command or code:
COMMAND-OR-CODE

Expected result:
EXPECTED-RESULT

Actual result:
ACTUAL-RESULT

Complete error:
ERROR-MESSAGE

Please:

1. Explain the error in beginner-friendly language.
2. Identify the most likely cause.
3. Give me one troubleshooting step at a time.
4. Explain what each command does before asking me to run it.
5. Do not ask for passwords, tokens, API keys, or private information.
6. Do not tell me to reinstall Node unless you explain why it is necessary.
```

AI suggestions can be incorrect or outdated. Read each proposed command before running it. Ask your instructor before following a suggestion that would:

- Delete files
- Reset Git history
- Force-push a branch
- Reinstall Node.js
- Change your system configuration
- Expose credentials or private information

Making pull request