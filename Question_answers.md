# Viva & Defensive Q&A

## 1️⃣ Core Viva Questions

**Q: What problem does your project solve?**
**A:** Scira solves the scalability crisis in oral assessments. Universities cannot practically interview hundreds of students one-on-one. Our system automates this high-quality qualitative assessment, ensuring every student gets a fair, standardized, and deep technical interview without administrative bottlenecks.

**Q: Why did you choose viva over written exams?**
**A:** Written exams are increasingly vulnerable to AI generation tools. A viva—an oral defense—is dynamic. It forces the student to explain their thought process in real-time. You can copy code, but you cannot fake a live, detailed explanation of that code under questioning.

**Q: What makes this system "intelligent"?**
**A:** It’s not just a script. It uses a Retrieval-Augmented Generation (RAG) engine to understand the specific syllabus, and it maintains "Contextual Awareness." If a student gives a partial answer, Scira knows to ask a follow-up probing question rather than just moving on. It mimics the behavior of a human examiner, not a multiple-choice machine.

---

## 2️⃣ 🔥 Critical Question (MANDATORY)

**Q: "How is this different from ChatGPT? Why build this?"**

**A:**
"That is a great question. The fundamental difference is **Intent** and **Control**.
ChatGPT is an **Assistant** designed to satisfy the user and give answers.
Scira is an **Examiner** designed to *challenge* the user and evaluate answers.
ChatGPT will hallucinate to be helpful; Scira is strictly grounded in the provided syllabus and rubrics. Most importantly, Scira controls the flow of the conversation, enforcing a structured assessment protocol that ChatGPT simply cannot do out of the box."

*(Pause. Look confident.)*

---

## 3️⃣ Defensive / Tricky Examiner Questions

**Q: Can students cheat this system?**
**A:** "No system is 100% unhackable, but we have raised the bar significantly. We use **Identity Snapshots** to verify the authorized student is present before starting. During the session, we combine **Tab-Switching Detection** and **Environment Noise Monitoring**. Since the exam is conversational and rapid-fire, there is simply no time for a student to look up complex conceptual answers without the AI noticing the delay or the eye movement."

**Q: How do you know the person speaking is actually the student?**
**A:** "We enforce a strict onboarding flow. Before the exam starts, the student must capture a real-time photo which is stored immutably in S3. This snapshot is manually reviewable by the instructor if any suspicion arises. Furthermore, we are capturing the voice profile of the speaker throughout the session for future audit."

**Q: What if the AI gives the wrong evaluation?**
**A:** "Scira is designed as a 'Human-in-the-Loop' system. The AI provides a suggested grade and a detailed transcript with reasoning. The faculty always has the final override authority. We view the AI as a high-efficiency filter that handles the bulk of the work, allowing professors to focus only on the borderline or contested cases."

**Q: Is this reliable for grading? What about bias?**
**A:** "Actually, AI is often *less* biased than humans. Humans suffer from fatigue, mood changes, or unconscious biases. Scira evaluates every student against the exact same rubric, with the same patience, whether it's the first student of the morning or the last one at night. We have tested this calibration against human graders and found a high degree of correlation."

**Q: Can this replace teachers?**
**A:** "Absolutely not. Scira replaces the *drudgery* of grading, not the teacher. It frees up faculty time from repetitive assessment tasks so they can focus on mentoring, research, and teaching—the things that actually require a human touch."

**Q: What happens if the internet fails?**
**A:** "The system is built with resilience in mind. We use a **State Machine** on the backend. If a connection drops, the session state is preserved in Redis. When the student reconnects, the exam resumes exactly where it left off, without losing any progress or context."

**Q: Why should we trust AI for viva?**
**A:** "Because it offers **Auditability**. In a traditional viva, there is no record of what was asked or answered. With Scira, every single interaction, pause, and answer is transcribed and recorded. If a student challenges a grade, we have perfect data to review. That level of transparency typically doesn't exist in manual vivas."

---

## 4️⃣ Final Confidence Closer

**(If the examiner asks: "Any final comments?")**

"We built Scira because we believe assessment needs to evolve. We cannot grade 21st-century students with 20th-century methods. This project is not just a prototype; it is a scalable, secure, and necessary solution for the future of education. We are ready to deploy it."
