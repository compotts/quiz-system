import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { groupsAPI, quizzesAPI, attemptsAPI } from '../services/api';
import QuizTaker from '../components/QuizTaker';

export default function StudentDashboard() {
  const { user, logout } = useAuthStore();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const groupsRes = await groupsAPI.getGroups();
      const groupsData = groupsRes.data;

      const groupsWithQuizzes = await Promise.all(
        groupsData.map(async (group) => {
          const quizzesRes = await quizzesAPI.getQuizzes(group.id);
          return { ...group, quizzes: quizzesRes.data };
        })
      );

      setGroups(groupsWithQuizzes);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (joinCode.length !== 6) {
      setJoinError('Код должен состоять из 6 цифр');
      return;
    }

    try {
      await groupsAPI.joinGroup(joinCode);
      setShowJoinModal(false);
      setJoinCode('');
      setJoinError('');
      loadGroups();
    } catch (error) {
      setJoinError(error.response?.data?.detail || 'Ошибка присоединения');
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Вы уверены, что хотите покинуть группу?')) return;

    try {
      await groupsAPI.leaveGroup(groupId);
      loadGroups();
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  };

  const handleStartQuiz = (quiz) => {
    setSelectedQuiz(quiz);
  };

  const handleQuizComplete = () => {
    setSelectedQuiz(null);
    loadGroups();
  };

  if (selectedQuiz) {
    return <QuizTaker quiz={selectedQuiz} onComplete={handleQuizComplete} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-6 sm:py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800/40 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 mb-6 sm:mb-8 border border-gray-700/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                🎯 Мои группы
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">
                Добро пожаловать, {user?.first_name || user?.username}!
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={() => setShowJoinModal(true)}
                className="bg-blue-600 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg text-sm sm:text-base"
              >
                + Присоединиться к группе
              </button>
              <button
                onClick={logout}
                className="bg-red-600 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-red-700 transition border border-red-500/50 text-sm sm:text-base"
              >
                Выход
              </button>
            </div>
          </div>
        </div>

        {/* Groups List */}
        {loading ? (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-gray-800/40 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-2xl p-8 sm:p-12 text-center border border-gray-700/50">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">Вы пока не состоите ни в одной группе</h3>
            <p className="text-gray-400 mb-6 text-sm sm:text-base">
              Попросите учителя дать вам код группы и присоединитесь!
            </p>
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-blue-600 text-white font-semibold px-6 sm:px-8 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg text-sm sm:text-base"
            >
              Присоединиться к группе
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.id} className="bg-gray-800/40 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 border border-gray-700/50 hover:border-gray-600/70 transition-all duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">{group.name}</h3>
                    <p className="text-gray-400 text-sm sm:text-base">
                      Код: <span className="font-mono font-bold text-blue-400">{group.code}</span>
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <span className="bg-gray-900/50 px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm text-gray-300 border border-gray-700">
                      👥 {group.member_count} участников
                    </span>
                    <button
                      onClick={() => handleLeaveGroup(group.id)}
                      className="text-red-400 hover:text-red-300 text-xs sm:text-sm font-medium transition-colors"
                    >
                      Покинуть группу
                    </button>
                  </div>
                </div>

                {group.quizzes.length > 0 ? (
                  <div>
                    <h5 className="font-semibold mb-3 text-gray-300">Викторины:</h5>
                    <div className="space-y-2">
                      {group.quizzes.map((quiz) => (
                        <div
                          key={quiz.id}
                          onClick={() => handleStartQuiz(quiz)}
                          className="bg-gray-900/50 p-4 rounded-lg hover:bg-gray-900/70 cursor-pointer transition border border-gray-700 hover:border-purple-500/50"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h6 className="font-semibold text-white">{quiz.title}</h6>
                              <p className="text-sm text-gray-400">{quiz.description}</p>
                            </div>
                            <span className="bg-blue-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium">
                              {quiz.question_count} вопросов
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">Пока нет викторин</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800/90 backdrop-blur-lg rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-md w-full border border-gray-700/50 shadow-2xl">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Присоединиться к группе</h3>
            <p className="text-gray-400 mb-4 text-sm sm:text-base">
              Введите 6-значный код группы, который вам дал учитель
            </p>

            {joinError && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4 backdrop-blur-sm text-sm">
                {joinError}
              </div>
            )}

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={6}
              placeholder="000000"
              className="w-full px-4 py-3 sm:py-4 text-center text-xl sm:text-2xl font-mono tracking-widest bg-gray-900/50 border-2 border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 text-white placeholder-gray-500"
            />

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinCode('');
                  setJoinError('');
                }}
                className="flex-1 bg-gray-700 text-gray-300 font-semibold py-2 sm:py-3 rounded-lg hover:bg-gray-600 transition border border-gray-600 text-sm sm:text-base"
              >
                Отмена
              </button>
              <button
                onClick={handleJoinGroup}
                className="flex-1 bg-blue-600 text-white font-semibold py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-lg text-sm sm:text-base"
              >
                Присоединиться
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}