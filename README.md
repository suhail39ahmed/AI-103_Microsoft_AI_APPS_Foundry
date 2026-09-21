# Cert Exam Prep

Generic local practice-exam player. Add any certification as a JSON bank, then take full exams, timed sets, or random drills with instant correct/wrong feedback.

## Run

```powershell
cd C:\Users\SuhailInayathulla\Documents\cert-exam-prep
python -m http.server 8787
```

Open http://localhost:8787

## Included exams

| Exam | What it is |
| --- | --- |
| **AI-103** | Azure AI Apps and Agents Developer Associate — full bank plus a senior / Contoso case-study set |
| **AI-103 Extra drills** | Additional original practice on Foundry, agents, RAG, safety, and Speech |

Keep this repository **private** if you include third-party practice dumps.

## Add another exam

1. Create `data/exams/<slug>/exam.json` and `questions.json`
2. Register the slug in `data/catalog.json`

See `data/exams/_template/exam.json` for the shape.
