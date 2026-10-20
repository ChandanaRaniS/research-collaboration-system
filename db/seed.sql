-- Sample data for demos. Run after schema.sql:
--   mysql -u root -p research_collaboration < db/seed.sql
-- Papers are inserted with uploaded_by = NULL (any logged-in user may edit them).
-- After seeding, click "Rebuild semantic index" on the Papers page (or POST /api/papers/reindex)
-- so ChromaDB picks these papers up.
USE research_collaboration;

INSERT IGNORE INTO Authors (full_name, affiliation) VALUES
  ('Ashish Vaswani',   'Google Brain'),
  ('Noam Shazeer',     'Google Brain'),
  ('Kaiming He',       'Microsoft Research'),
  ('Xiangyu Zhang',    'Microsoft Research'),
  ('Jacob Devlin',     'Google AI Language'),
  ('Ming-Wei Chang',   'Google AI Language'),
  ('Ian Goodfellow',   'Université de Montréal'),
  ('Yoshua Bengio',    'Université de Montréal'),
  ('Jennifer Doudna',  'University of California, Berkeley'),
  ('Emmanuelle Charpentier', 'Max Planck Unit for the Science of Pathogens'),
  ('Satoshi Nakamoto', NULL),
  ('Leslie Lamport',   'Microsoft Research'),
  ('Edgar F. Codd',    'IBM Research'),
  ('Peter Shor',       'AT&T Bell Laboratories');

INSERT IGNORE INTO ResearchPapers (title, abstract, domain, publication_year, keywords, doi) VALUES
 ('Attention Is All You Need',
  'We propose the Transformer, a network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.',
  'Machine Learning', 2017, 'transformer, attention, sequence modeling, translation', '10.48550/arXiv.1706.03762'),
 ('Deep Residual Learning for Image Recognition',
  'Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously, reformulating layers as learning residual functions with reference to the layer inputs.',
  'Computer Vision', 2016, 'resnet, image classification, deep learning, residual connections', '10.1109/CVPR.2016.90'),
 ('BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
  'We introduce BERT, which stands for Bidirectional Encoder Representations from Transformers. BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
  'Natural Language Processing', 2019, 'bert, language model, pre-training, transformers', '10.18653/v1/N19-1423'),
 ('Generative Adversarial Nets',
  'We propose a new framework for estimating generative models via an adversarial process, in which we simultaneously train two models: a generative model that captures the data distribution, and a discriminative model that estimates the probability that a sample came from the training data.',
  'Machine Learning', 2014, 'gan, generative models, adversarial training', '10.48550/arXiv.1406.2661'),
 ('A Programmable Dual-RNA-Guided DNA Endonuclease in Adaptive Bacterial Immunity',
  'Clustered regularly interspaced short palindromic repeats (CRISPR)/Cas systems provide bacteria and archaea with adaptive immunity. We show that the Cas9 endonuclease can be programmed with a single guide RNA to cleave target DNA, opening the way to genome editing.',
  'Genetics', 2012, 'crispr, cas9, genome editing, gene therapy', '10.1126/science.1225829'),
 ('Time, Clocks, and the Ordering of Events in a Distributed System',
  'The concept of one event happening before another in a distributed system is examined, and is shown to define a partial ordering of the events. A distributed algorithm is given for synchronizing a system of logical clocks which can be used to totally order the events.',
  'Distributed Systems', 1978, 'logical clocks, distributed computing, causality, ordering', '10.1145/359545.359563'),
 ('A Relational Model of Data for Large Shared Data Banks',
  'Future users of large data banks must be protected from having to know how the data is organized in the machine. We propose the relational model, in which data is represented as relations with a basis in set theory and predicate logic, enabling data independence and query languages.',
  'Databases', 1970, 'relational model, database theory, data independence, SQL', '10.1145/362384.362685'),
 ('Algorithms for Quantum Computation: Discrete Logarithms and Factoring',
  'A computer is generally considered to be a universal computational device. We show that on a quantum computer, the problems of finding discrete logarithms and factoring integers can be solved in polynomial time, threatening widely used public-key cryptography.',
  'Quantum Computing', 1994, 'quantum algorithms, factoring, cryptography, shor', '10.1109/SFCS.1994.365700');

-- Bitcoin has no DOI, so guard against duplicates by title instead.
INSERT INTO ResearchPapers (title, abstract, domain, publication_year, keywords, doi)
SELECT 'Bitcoin: A Peer-to-Peer Electronic Cash System',
  'A purely peer-to-peer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution. The network timestamps transactions by hashing them into an ongoing chain of hash-based proof-of-work.',
  'Distributed Systems', 2008, 'blockchain, cryptocurrency, proof of work, decentralization', NULL
WHERE NOT EXISTS (SELECT 1 FROM ResearchPapers WHERE title = 'Bitcoin: A Peer-to-Peer Electronic Cash System');

-- Link authors (order = byline position)
INSERT IGNORE INTO PaperAuthors (paper_id, author_id, author_order)
SELECT p.paper_id, a.author_id, x.ord FROM (
  SELECT 'Attention Is All You Need' t, 'Ashish Vaswani' n, 1 ord UNION ALL
  SELECT 'Attention Is All You Need', 'Noam Shazeer', 2 UNION ALL
  SELECT 'Deep Residual Learning for Image Recognition', 'Kaiming He', 1 UNION ALL
  SELECT 'Deep Residual Learning for Image Recognition', 'Xiangyu Zhang', 2 UNION ALL
  SELECT 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', 'Jacob Devlin', 1 UNION ALL
  SELECT 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', 'Ming-Wei Chang', 2 UNION ALL
  SELECT 'Generative Adversarial Nets', 'Ian Goodfellow', 1 UNION ALL
  SELECT 'Generative Adversarial Nets', 'Yoshua Bengio', 2 UNION ALL
  SELECT 'A Programmable Dual-RNA-Guided DNA Endonuclease in Adaptive Bacterial Immunity', 'Jennifer Doudna', 1 UNION ALL
  SELECT 'A Programmable Dual-RNA-Guided DNA Endonuclease in Adaptive Bacterial Immunity', 'Emmanuelle Charpentier', 2 UNION ALL
  SELECT 'Bitcoin: A Peer-to-Peer Electronic Cash System', 'Satoshi Nakamoto', 1 UNION ALL
  SELECT 'Time, Clocks, and the Ordering of Events in a Distributed System', 'Leslie Lamport', 1 UNION ALL
  SELECT 'A Relational Model of Data for Large Shared Data Banks', 'Edgar F. Codd', 1 UNION ALL
  SELECT 'Algorithms for Quantum Computation: Discrete Logarithms and Factoring', 'Peter Shor', 1
) x
JOIN ResearchPapers p ON p.title = x.t
JOIN Authors a ON a.full_name = x.n;
