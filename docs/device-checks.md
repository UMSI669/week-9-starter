# Physical-device acceptance checks

Automated browser tests and platform bundle exports do not replace these checks.
Use a phone with Expo Go matching SDK 58, or install an EAS development/preview build.

| Check | Expected behavior | Device result |
| --- | --- | --- |
| Deny microphone access | An error and Settings action; no recording starts | Pending |
| Record a spoken list | Waveform and timer; transcript and items appear after Stop | Pending |
| Record for 60 seconds | Warning at 50 seconds; recording automatically stops at 60 | Pending |
| Background while recording | Microphone stops; audio is retained with Retry | Pending |
| Airplane mode, manual entry | Add, edit, check, and delete/undo work locally | Pending |
| Airplane mode, transcription | Error with Retry; recording is retained | Pending |
| Edit transcript | Re-parse updates items without uploading audio again | Pending |
| Duplicate name and unit | Quantities add; the merge toast explains the new total | Pending |
| Same name, different units | Items remain separate | Pending |
| Drag and swipe | Drag only within category; swipe Delete offers Undo | Pending |
| Restart the app | Items, checkmarks, order, and list/grid preference persist | Pending |
| Change clock to next Sunday | Unchecked items carry over once; past week stays read-only | Pending |
| Reopen/foreground repeatedly | No duplicate carry-over items | Pending |
| Screen reader and large text | Controls are labeled and usable; selected/checked states are announced | Pending |
| Haptics | Check-off and recording actions provide feedback on supported hardware | Pending |

The user will perform native acceptance in Expo Go and has chosen to skip the
signed cloud build. Browser tests simulate permission denial,
backgrounding, offline mode, recording limits, and Sunday rollover.
