// src/lib/roles.js — shared by the UI and the API routes.
// Each role has: focus areas (fed to the LLM), keywords (for resume -> role matching)
// and an offline question bank (used when no LLM key is configured or the LLM fails).

export const TIME_BY_DIFFICULTY = { easy: 90, medium: 150, hard: 240 };

const q = (difficulty, topic, text, expected_points) => ({ difficulty, topic, text, expected_points });

export const ROLES = {
  ai: {
    id: "ai",
    label: "AI Developer",
    tagline: "LLMs, RAG, agents, prompt engineering",
    focus: ["LLM APIs & prompting", "RAG & vector search", "agents & tool calling", "evaluation & guardrails", "latency/cost"],
    keywords: ["llm", "openai", "langchain", "llamaindex", "rag", "embeddings", "vector", "prompt", "transformers", "hugging face", "gpt", "agents", "pinecone", "chroma", "faiss", "generative ai"],
    bank: [
      q("easy", "Prompting", "What makes a prompt reliable enough for production use?", ["clear instructions and role", "few-shot examples", "output format constraints (JSON schema)", "iterate with test cases"]),
      q("easy", "RAG", "What is RAG, and why use it instead of fine-tuning for private knowledge?", ["retrieve relevant chunks then inject into prompt", "reduces hallucination via grounding", "fresh data without retraining", "cheaper and easier to update"]),
      q("easy", "LLM basics", "What are tokens and the context window, and why do they matter for cost and quality?", ["tokens are sub-word units", "window limits input plus output", "cost scales with tokens", "long context can degrade quality"]),
      q("medium", "RAG", "How would you chunk documents and pick embeddings for a RAG pipeline? Name key trade-offs.", ["chunk size and overlap", "semantic or structural boundaries", "embedding model domain and dimensions", "metadata filtering", "top-k and reranking"]),
      q("medium", "Reliability", "How do you reduce hallucinations in an LLM application?", ["ground answers in retrieved context", "ask for citations", "lower temperature", "validate structured output", "allow 'I don't know'", "evals"]),
      q("medium", "Agents", "Explain tool/function calling and how an agent loop works.", ["model emits structured tool call", "app executes the tool", "result returned to model", "loop until done with step limit", "guardrails and permissions"]),
      q("hard", "Evaluation", "How would you evaluate an LLM application before and after launch?", ["golden dataset", "automated metrics or LLM-as-judge", "human review", "regression tests on prompt changes", "online monitoring and feedback", "track cost and latency"]),
      q("hard", "Debugging", "Your RAG app is slow and sometimes wrong. How do you diagnose and fix it?", ["separate retrieval vs generation failures", "measure recall@k", "hybrid search and reranking", "caching and streaming", "trim context", "tracing"]),
    ],
  },
  ml: {
    id: "ml",
    label: "ML Engineer",
    tagline: "Modelling, training, MLOps, deployment",
    focus: ["model training & tuning", "feature engineering", "evaluation metrics", "deep learning", "MLOps & serving", "drift/monitoring"],
    keywords: ["machine learning", "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn", "xgboost", "deep learning", "cnn", "rnn", "lstm", "mlops", "mlflow", "kubeflow", "neural network", "computer vision", "nlp", "model deployment"],
    bank: [
      q("easy", "Fundamentals", "Explain the bias-variance trade-off and how you spot each in practice.", ["bias = underfit, variance = overfit", "compare train vs validation error", "more data or regularisation reduces variance", "more capacity reduces bias"]),
      q("easy", "Data", "What is data leakage and how do you prevent it?", ["information from test/future leaks into training", "split before preprocessing", "fit scalers on train only", "time-based splits for temporal data"]),
      q("easy", "Metrics", "When would you favour precision over recall, and vice versa? Give examples.", ["precision when false positives are costly", "recall when false negatives are costly", "concrete examples (spam, cancer screening)", "F1 or PR curve to balance"]),
      q("medium", "Imbalance", "How do you handle a heavily imbalanced classification dataset?", ["right metrics (PR-AUC, F1)", "resampling or SMOTE", "class weights", "threshold tuning", "stratified splits"]),
      q("medium", "Regularisation", "Compare L1 and L2 regularisation and list other ways to fight overfitting.", ["L1 gives sparsity, L2 shrinks weights", "dropout", "early stopping", "more data or augmentation", "cross-validation"]),
      q("medium", "Deep learning", "How does self-attention work in a transformer, and why does it beat RNNs for long sequences?", ["queries, keys, values", "weighted sum by similarity", "parallel computation", "captures long-range dependencies", "positional encoding"]),
      q("hard", "MLOps", "How would you take a trained model to production and keep it healthy?", ["packaging and serving (API, batch)", "versioning of data, code and models", "monitoring latency and quality", "drift detection", "automated retraining and rollback", "CI/CD"]),
      q("hard", "Debugging", "A model's accuracy drops weeks after deployment. How do you investigate?", ["data drift vs concept drift", "training-serving skew", "upstream pipeline changes", "compare feature distributions", "retrain or recalibrate with fresh data"]),
    ],
  },
  ds: {
    id: "ds",
    label: "Data Scientist",
    tagline: "Statistics, experimentation, analysis, storytelling",
    focus: ["statistics & probability", "A/B testing", "SQL & analysis", "feature engineering", "metrics", "communicating insights"],
    keywords: ["statistics", "pandas", "numpy", "sql", "tableau", "power bi", "matplotlib", "seaborn", "a/b testing", "hypothesis", "regression", "data analysis", "visualization", "r programming", "jupyter", "eda", "forecasting"],
    bank: [
      q("easy", "Statistics", "When would you report the median rather than the mean?", ["skewed distributions", "outliers distort the mean", "income or latency examples", "robust statistic"]),
      q("easy", "Statistics", "Explain what a p-value is and one common way it is misinterpreted.", ["probability of data this extreme if null is true", "not the probability the null is true", "threshold such as 0.05", "statistical vs practical significance"]),
      q("easy", "ML basics", "What is the difference between supervised and unsupervised learning? Give examples.", ["labels vs no labels", "classification/regression examples", "clustering or dimensionality reduction examples"]),
      q("medium", "Experimentation", "How would you design and analyse an A/B test for a new checkout button?", ["clear hypothesis and primary metric", "sample size and power", "random assignment", "run full duration, avoid peeking", "guardrail metrics", "significance test"]),
      q("medium", "Data quality", "How do you deal with missing data? When is each approach appropriate?", ["understand why it is missing (MCAR/MAR/MNAR)", "drop vs impute", "mean/median/model-based imputation", "missing indicator feature", "check impact on results"]),
      q("medium", "Causality", "Correlation vs causation: how would you argue a causal effect from observational data?", ["confounders", "randomised experiment ideal", "natural experiments, diff-in-diff, matching", "state assumptions", "sensitivity checks"]),
      q("hard", "Modelling", "A fraud model shows 99% accuracy on data with 1% fraud. What is wrong and what do you do?", ["accuracy misleading on imbalance", "use precision, recall, PR-AUC", "cost-sensitive thresholds", "resampling or class weights", "review with business costs"]),
      q("hard", "Analytics", "Your key metric dropped 10% week over week. Walk through your investigation.", ["verify data and tracking first", "segment by platform, region, cohort", "check recent releases and seasonality", "funnel decomposition", "form and test hypotheses", "communicate findings and next steps"]),
    ],
  },
  sde: {
    id: "sde",
    label: "Software Engineer",
    tagline: "Data structures, backend, APIs, system thinking",
    focus: ["data structures & algorithms", "APIs & backend", "databases", "concurrency", "testing & code quality", "scalability basics"],
    keywords: ["java", "python", "c++", "javascript", "typescript", "react", "node", "spring", "rest", "api", "microservices", "data structures", "algorithms", "sql", "git", "backend", "frontend", "full stack", "golang", "django", "express"],
    bank: [
      q("easy", "DSA", "What is the time complexity of hash-map lookup and when does it degrade?", ["O(1) average", "collisions degrade to O(n)", "good hash function and resizing", "balanced trees in buckets"]),
      q("easy", "OS", "What is the difference between a process and a thread?", ["process has isolated memory", "threads share memory in a process", "context-switch cost", "synchronisation needed for threads"]),
      q("easy", "APIs", "What does it mean for an HTTP method to be idempotent? Which ones are?", ["same request repeated gives same effect", "GET, PUT, DELETE idempotent", "POST is not", "why it matters for retries"]),
      q("medium", "Databases", "How does a database index speed up queries and what does it cost?", ["B-tree lookups instead of full scan", "slower writes", "extra storage", "composite index column order", "avoid over-indexing"]),
      q("medium", "Performance", "What is the N+1 query problem and how do you fix it?", ["one query plus N per-row queries", "joins or eager loading", "batching", "caching", "detect via query logs"]),
      q("medium", "Caching", "Describe caching strategies and the hardest part of caching.", ["cache-aside, write-through", "TTL", "invalidation is hard", "stale data trade-offs", "stampede protection"]),
      q("hard", "Concurrency", "How do you make a payment API safe against duplicate requests and race conditions?", ["idempotency keys", "unique constraints", "transactions and locking", "retry-safe design", "optimistic concurrency"]),
      q("hard", "Scalability", "Explain how you would implement a rate limiter and the trade-offs between algorithms.", ["token bucket / leaky bucket", "fixed vs sliding window", "per-user or per-IP key", "shared store like Redis", "distributed consistency"]),
    ],
  },
  cloud: {
    id: "cloud",
    label: "Cloud / DevOps Engineer",
    tagline: "AWS/Azure/GCP, containers, CI/CD, reliability",
    focus: ["cloud services", "networking & IAM", "containers & Kubernetes", "IaC", "CI/CD & deployments", "observability & cost"],
    keywords: ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "jenkins", "github actions", "ansible", "linux", "cloudformation", "devops", "helm", "prometheus", "grafana", "ec2", "lambda", "s3", "vpc"],
    bank: [
      q("easy", "Basics", "Explain IaaS, PaaS and SaaS with one example each.", ["IaaS: raw VMs (EC2)", "PaaS: managed runtime (App Engine, Beanstalk)", "SaaS: finished software", "who manages what"]),
      q("easy", "Networking", "What is a VPC and how do public and private subnets differ?", ["isolated virtual network", "public subnet has route to internet gateway", "private uses NAT for outbound", "security groups and NACLs"]),
      q("easy", "IaC", "Why use Infrastructure as Code? Name a tool and one benefit.", ["repeatable environments", "version control and review", "drift detection", "Terraform / CloudFormation"]),
      q("medium", "Containers", "How do containers differ from VMs, and what does Kubernetes add on top of Docker?", ["share host kernel, lighter", "faster start", "orchestration, scheduling, self-healing", "scaling and service discovery"]),
      q("medium", "Deployments", "Compare blue/green, canary and rolling deployments.", ["blue/green: switch whole traffic", "canary: small % first", "rolling: gradual replacement", "rollback speed and cost"]),
      q("medium", "Security", "How do you apply least privilege in cloud IAM and handle secrets?", ["scoped roles/policies", "no long-lived keys, use roles", "secrets manager/vault", "rotate credentials", "audit with CloudTrail-like logs"]),
      q("hard", "Reliability", "How would you design for high availability and disaster recovery? Explain RTO/RPO.", ["multi-AZ / multi-region", "load balancers and health checks", "backups and replication", "RTO = time to recover, RPO = data loss window", "test failover"]),
      q("hard", "Troubleshooting", "A Kubernetes pod is in CrashLoopBackOff in production. How do you debug it?", ["kubectl describe and logs (previous)", "check exit code and OOMKilled", "config/secret/env issues", "probes failing", "resource limits", "rollback if needed"]),
    ],
  },
  cyber: {
    id: "cyber",
    label: "Cybersecurity Engineer",
    tagline: "AppSec, network security, incident response",
    focus: ["web & app security (OWASP)", "cryptography", "network security", "IAM & zero trust", "threat modelling", "incident response"],
    keywords: ["security", "owasp", "penetration", "pentest", "siem", "soc", "cryptography", "firewall", "vulnerability", "burp", "nmap", "wireshark", "metasploit", "incident response", "threat", "malware", "iso 27001", "ethical hacking", "kali"],
    bank: [
      q("easy", "Fundamentals", "Explain the CIA triad with an example of each property being violated.", ["confidentiality: data leak", "integrity: tampering", "availability: DoS/ransomware", "controls for each"]),
      q("easy", "Crypto", "Symmetric vs asymmetric encryption: differences and where each is used.", ["one shared key vs key pair", "symmetric is fast for bulk data", "asymmetric for key exchange/signatures", "TLS uses both"]),
      q("easy", "AppSec", "What are SQL injection and XSS, and how do you prevent each?", ["SQLi: untrusted input in queries", "parameterised queries", "XSS: script injected in pages", "output encoding and CSP", "input validation"]),
      q("medium", "Network", "Walk through how TLS secures an HTTPS connection.", ["certificate validation / CA chain", "key exchange", "symmetric session keys", "integrity checks", "protection from MITM"]),
      q("medium", "AuthN", "How should a web app store passwords and protect sessions?", ["salted slow hash (bcrypt/argon2)", "never plain/fast hash", "MFA", "secure, HttpOnly cookies", "session expiry and rotation", "rate limiting"]),
      q("medium", "Architecture", "What is zero trust and how does it differ from perimeter security?", ["never trust, always verify", "identity and device based access", "least privilege", "micro-segmentation", "continuous monitoring"]),
      q("hard", "Incident response", "A server is suspected compromised. Walk through your incident response.", ["contain/isolate", "preserve evidence and logs", "identify scope and root cause", "eradicate and recover", "lessons learned", "communication"]),
      q("hard", "Threat modelling", "How would you threat-model a new web application using STRIDE?", ["diagram assets and trust boundaries", "spoofing, tampering, repudiation, info disclosure, DoS, elevation", "rank risks", "map mitigations", "revisit as design changes"]),
    ],
  },
};

export const ROLE_LIST = Object.values(ROLES);
export const getRole = (id) => ROLES[id] || ROLES.sde;

/** Score every role against resume text + skills and return roles sorted best-first. */
export function rankRoles(text = "", skills = []) {
  const hay = `${text}\n${skills.join("\n")}`.toLowerCase();
  return ROLE_LIST.map((r) => {
    let score = 0;
    for (const k of r.keywords) {
      const re = new RegExp(`(?<![a-z0-9])${k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?![a-z0-9])`, "g");
      const hits = hay.match(re);
      if (hits) score += Math.min(hits.length, 3);
    }
    return { id: r.id, score };
  }).sort((a, b) => b.score - a.score);
}
