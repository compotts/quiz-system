import { useState, useEffect } from 'react';
import { quizzesAPI, attemptsAPI } from '../services/api';

export default function QuizTaker({ quiz, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptId, setAttemptId] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    startQuiz();
  }, []);

  const startQuiz = async () => {
    try {
      // Проверяем незавершенную попытку
      const currentRes = await attemptsAPI.getCurrentAttempt(quiz.id);
      
      if (currentRes.data.has_attempt) {
        if (window.confirm('У вас есть незавершенная попытка. Продолжить?')) {
          setAttemptId(currentRes.data.attempt_id);
        } else {
          onComplete();
          return;
        }
      } else {
        // Начинаем новую попытку
        const attemptRes = await attemptsAPI.startAttempt(quiz.id);
        setAttemptId(attemptRes.data.id);
      }

      // Загружаем вопросы
      const questionsRes = await quizzesAPI.getQuestions(quiz.id);
      setQuestions(questionsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error starting quiz:', error);
      alert('Ошибка загрузки викторины');
      onComplete();
    }
  };

  const handleOptionToggle = (optionId) => {
    const currentQuestion = questions[currentQuestionIndex];
    
    if (currentQuestion.question_type === 'single_choice') {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const handleSubmitAnswer = async () => {
    if (selectedOptions.length === 0) {
      alert('Выберите хотя бы один ответ');
      return;
    }

    try {
      const currentQuestion = questions[currentQuestionIndex];
      
      await attemptsAPI.submitAnswer({
        question_id: currentQuestion.id,
        selected_options: selectedOptions,
      });

      // Переход к следующему вопросу или завершение
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOptions([]);
      } else {
        await completeQuiz();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Ошибка отправки ответа');
    }
  };

  const completeQuiz = async () => {
    try {
      const resultRes = await attemptsAPI.completeAttempt(attemptId);
      setResult(resultRes.data);
      setIsCompleted(true);
    } catch (error) {
      console.error('Error completing quiz:', error);
      alert('Ошибка завершения викторины');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p>Загрузка викторины...</p>
        </div>
      </div>
    );
  }

  if (isCompleted && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-6xl text-green-500 mb-4">✓</div>
          <h2 className="text-3xl font-bold mb-4">Викторина завершена!</h2>
          <p className="text-xl text-gray-600 mb-2">Ваш результат:</p>
          <h1 className="text-6xl font-bold text-purple-600 mb-4">
            {result.percentage.toFixed(1)}%
          </h1>
          <p className="text-gray-600 mb-8">
            {result.score} из {result.max_score} баллов
          </p>
          <button
            onClick={onComplete}
            className="bg-purple-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-purple-700 transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isMultipleChoice = currentQuestion.question_type === 'multiple_choice';
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-purple-600 mb-2">{quiz.title}</h2>
            
            {/* Progress Bar */}
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block text-purple-600">
                    Вопрос {currentQuestionIndex + 1} из {questions.length}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-purple-600">
                    {progress.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-purple-200">
                <div
                  style={{ width: `${progress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-600 transition-all duration-300"
                ></div>
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-6">{currentQuestion.text}</h3>
            
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOptions.includes(option.id);
                
                return (
                  <div
                    key={option.id}
                    onClick={() => handleOptionToggle(option.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type={isMultipleChoice ? 'checkbox' : 'radio'}
                        checked={isSelected}
                        onChange={() => {}}
                        className="mr-3 h-5 w-5 text-purple-600"
                      />
                      <label className="flex-1 cursor-pointer">{option.text}</label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {isMultipleChoice ? 'Можно выбрать несколько вариантов' : 'Выберите один вариант'}
            </div>
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedOptions.length === 0}
              className="bg-purple-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentQuestionIndex === questions.length - 1
                ? 'Завершить'
                : 'Следующий вопрос'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}