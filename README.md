# AI-Powered Interview Assistant

This project is an AI-powered interview assistant designed to streamline the interview process for both interviewers and candidates. It includes features for resume upload and parsing, an interview chat interface with timers and auto-submit functionality, an interviewer dashboard, and persistence using Redux Toolkit and redux-persist.

## Features

- **Resume Upload and Parsing**: Candidates can upload their resumes in PDF or DOCX format. The application extracts contact information and adds candidates to the system.
- **Interview Chat**: A chat interface for interviewees to answer questions in real-time, with a countdown timer for each question.
- **Timer Functionality**: Each question has a timer that automatically submits the answer when time runs out.
- **Interviewer Dashboard**: A dashboard for interviewers to view candidates, their scores, and detailed chat histories.
- **Redux Toolkit**: State management is handled using Redux Toolkit, ensuring a predictable state container.
- **Serverless API**: Interactions with the AI are managed through a serverless API, allowing for dynamic question generation and answer evaluation.

## Project Structure

```
ai-interview-assistant
├── src
│   ├── app
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── ResumeUploader.jsx
│   │   ├── InterviewChat.jsx
│   │   ├── Timer.jsx
│   │   ├── Dashboard.jsx
│   │   └── CandidateList.jsx
│   ├── store
│   │   ├── index.js
│   │   ├── slices
│   │   │   ├── candidatesSlice.js
│   │   │   └── interviewSlice.js
│   └── utils
│       └── resumeParser.js
├── pages
│   ├── api
│   │   ├── ai.js
│   │   └── app.js
├── package.json
├── tsconfig.json
└── README.md
```

## Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd ai-interview-assistant
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```

4. **Open in Browser**:
   Navigate to `http://localhost:3000` to view the application.

## Deployment

To deploy the application, you can use platforms like Vercel or Netlify. Follow their respective documentation for deployment steps.

## Demo Script

1. Start the application and navigate to the home page.
2. Upload a resume using the Resume Uploader component.
3. Start an interview session and interact with the Interview Chat component.
4. Monitor the timer and submit answers as prompted.
5. Review the results in the Interviewer Dashboard.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.