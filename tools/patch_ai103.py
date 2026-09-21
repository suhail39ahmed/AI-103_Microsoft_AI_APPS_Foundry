"""Fix the senior / case-study segment and attach section labels."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QPATH = ROOT / "data" / "exams" / "ai-103" / "questions.json"

CASE_IDS = set(range(166, 176))
SENIOR_IDS = set(range(151, 166))


def yn(qid: int, stem: str, items: list[tuple[str, str, str]], expl: str) -> dict:
    return {
        "id": qid,
        "type": "yesno",
        "stem": stem,
        "items": [{"id": i, "text": t, "answer": a} for i, t, a in items],
        "explanation": expl,
        "points": len(items),
        "images": [f"assets/qimg/q{qid}_1.png"],
    }


def patch(q: dict) -> dict:
    qid = q["id"]
    if qid in SENIOR_IDS:
        q["section"] = "Senior skills"
    if qid in CASE_IDS:
        q["section"] = "Contoso case study"
        q["showCaseStudy"] = True

    if qid == 151:
        return yn(
            151,
            "You are building a solution that students will use to find references for essays. You use Azure Language linked-entity recognition to start building the solution. For each statement, select Yes if the statement is true. Otherwise, select No.",
            [
                ("1", "recognize_linked_entities() detects the language of the input document.", "No"),
                ("2", "The url property of a linked entity is always a Bing Search link.", "No"),
                ("3", "The matches collection can be used to find where each linked entity appears in the document.", "Yes"),
            ],
            "Linked-entity recognition maps mentions to a knowledge base. Language of the document needs a separate language-detection call. The URL points at the entity page in the data source (often Wikipedia), not necessarily Bing. Matches include offset and length so you can locate each mention.",
        ) | {"section": "Senior skills"}

    if qid == 152:
        return {
            "id": 152,
            "type": "matching",
            "section": "Senior skills",
            "stem": "You have a Microsoft Foundry project for a support-ticket triage app that reads ticket text from a database. You need to compare candidate models by quality, cost, and throughput, and you must not host model weights in your Azure subscription. What should you configure?",
            "slots": [
                {"id": "1", "label": "Compare models by quality, cost, and throughput", "answer": "Model catalog leaderboards and model cards"},
                {"id": "2", "label": "Do not host model weights in the subscription", "answer": "Serverless deployment"},
            ],
            "choices": [
                "Model catalog leaderboards and model cards",
                "Serverless deployment",
                "Configure private endpoint access",
                "Use deployment lists and license tabs",
                "Use tool catalog connections and run traces",
                "Bring your own model on managed compute",
                "Build a vector index",
            ],
            "explanation": "Leaderboards and model cards are how you compare quality, cost, and throughput before you deploy. A serverless deployment calls the model through an API without placing the weights in your subscription.",
            "points": 2,
            "images": q.get("images") or ["assets/qimg/q152_1.png"],
        }

    if qid == 154:
        return yn(
            154,
            "You are building an app that will define common AI terms. You send prompts to a chat model. For each statement, select Yes if the statement is true. Otherwise, select No.",
            [
                ("1", "The prompt \"What is an LLM?\" will produce a Large Language Model definition with a high degree of certainty.", "No"),
                ("2", "Changing the prompt to \"What is an LLM in the context of AI models?\" guarantees the intended response.", "No"),
                ("3", "A system message that restricts answers to AI language models increases the chance of the intended meaning.", "Yes"),
            ],
            "\"LLM\" is ambiguous, so the first prompt is not reliable. Adding context helps but does not guarantee an output. A stronger system message has higher priority and better steers the model toward Large Language Model.",
        ) | {"section": "Senior skills"}

    if qid == 160:
        return yn(
            160,
            "You start an Azure AI container with an EULA acceptance, billing endpoint, and API key. For each statement, select Yes if the statement is true. Otherwise, select No.",
            [
                ("1", "The /status endpoint verifies the API key by querying the Azure service endpoint.", "No"),
                ("2", "The start command shown writes persistent logs automatically.", "No"),
                ("3", "The /swagger endpoint exposes OpenAPI documentation for the container APIs.", "Yes"),
            ],
            "/status checks the key without sending a full Azure query. Disk or Fluentd logging must be configured explicitly. /swagger is the container's OpenAPI surface.",
        ) | {"section": "Senior skills"}

    if qid == 163:
        return {
            "id": 163,
            "type": "sequence",
            "section": "Senior skills",
            "stem": "You are building an app that will scan confidential documents and use Azure Language in Foundry Tools. Documents must remain on-premises. You already have a Microsoft Foundry Service resource. Which three actions should you perform in order?",
            "slots": [
                {"id": "1", "label": "Step 1", "answer": "Provision an on-premises Kubernetes cluster that has internet connectivity"},
                {"id": "2", "label": "Step 2", "answer": "Pull the Language container image from Microsoft Container Registry (MCR)"},
                {"id": "3", "label": "Step 3", "answer": "Run the container with the API key and endpoint URL of the Foundry resource"},
            ],
            "choices": [
                "Provision an on-premises Kubernetes cluster that has internet connectivity",
                "Pull the Language container image from Microsoft Container Registry (MCR)",
                "Run the container with the API key and endpoint URL of the Foundry resource",
                "Pull an image from Docker Hub",
                "Provision an on-premises Kubernetes cluster that is isolated from the internet",
                "Provision an Azure Kubernetes Service (AKS) resource",
            ],
            "explanation": "Process documents in a local Language container so content stays on-premises. The cluster still needs internet for billing and metering. Images come from MCR, then you start the container with the cloud resource key and endpoint.",
            "points": 3,
            "images": q.get("images") or ["assets/qimg/q163_1.png"],
        }

    if qid == 173:
        return {
            "id": 173,
            "type": "matching",
            "section": "Contoso case study",
            "showCaseStudy": True,
            "stem": "You need the marketing department to generate videos from the model deployed in Project2. How should you complete the Python calls?",
            "slots": [
                {"id": "1", "label": "Start a video generation job", "answer": "create"},
                {"id": "2", "label": "Poll job status until it finishes", "answer": "retrieve"},
            ],
            "choices": ["create", "retrieve", "download_content", "list"],
            "explanation": "create starts the asynchronous video job. retrieve polls status. download_content is only for the finished file. list enumerates jobs, it does not track one job.",
            "points": 2,
            "images": q.get("images") or ["assets/qimg/q173_1.png"],
        }

    if qid == 175:
        q["slots"] = [
            {"id": "1", "label": "Authenticate without API keys", "answer": "credential = DefaultAzureCredential()"},
            {"id": "2", "label": "Load the existing agent", "answer": "agent = project_client.agents.get(agent_name=myAgent)"},
        ]
        q["choices"] = [
            "credential = DefaultAzureCredential()",
            "agent = project_client.agents.get(agent_name=myAgent)",
            "AzureKeyCredential()",
            "None",
            "create_version",
            "get_version",
        ]
        q["explanation"] = (
            "Security requires Microsoft Entra ID, not API keys, so use DefaultAzureCredential. "
            "get(agent_name=...) loads the existing Agent1. create_version and get_version are the wrong operations."
        )

    if qid == 158:
        q["choices"] = [
            "Azure Document Intelligence in Foundry Tools",
            "Azure Language in Foundry Tools",
            "Azure AI Search",
            "Azure Vision in Foundry Tools",
        ]

    if qid == 164:
        q["choices"] = ["POST", "GET", "PATCH", "imageType", "description", "objects", "tags"]

    if qid == 166:
        q["choices"] = [
            "Standard",
            "Global Standard",
            "Global Provisioned",
            "Opt out of automatic model version upgrades",
            "Once the current version expires",
            "Upgrade once a new default version becomes available",
        ]

    return q


def main() -> None:
    payload = json.loads(QPATH.read_text(encoding="utf-8"))
    payload["questions"] = [patch(q) for q in payload["questions"]]
    payload["title"] = "AI-103: Azure AI Apps and Agents Developer Associate"
    payload["passPercent"] = 70
    QPATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("patched", len(payload["questions"]))


if __name__ == "__main__":
    main()
