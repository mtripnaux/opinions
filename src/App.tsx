import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import questionsRaw from './questions.json';
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteField, getDocs, collection, query, where } from 'firebase/firestore';
import { translations } from './translations';

type Lang = 'fr' | 'en';

interface QuestionData {
  id: string;
  question: {
    fr: string;
    en: string;
  };
  answers: {
    yes: string;
    no: string;
  };
}

interface AppQuestion {
  uniqueId: string;
  text: { [key in Lang]: string };
}

const questionsMap = new Map((questionsRaw as QuestionData[]).map(q => [q.id, q]));
const questions: AppQuestion[] = (questionsRaw as QuestionData[]).map((q) => ({
  uniqueId: q.id,
  text: q.question
}));

function LanguageRedirect() {
    const browserLang = navigator.language.startsWith('fr') ? 'fr' : 'en';
    return <Navigate to={`/${browserLang}`} replace />;
}

function UserProfile({ isGuest }: { isGuest?: boolean }) {
    const { username, lang } = useParams<{ username: string; lang: string }>();
    const currentLang = (lang === 'fr' || lang === 'en') ? lang : 'en';
    const t = translations[currentLang];
    
    if (lang !== 'fr' && lang !== 'en') {
        const browserLang = navigator.language.startsWith('fr') ? 'fr' : 'en';
        return <Navigate to={`/${browserLang}`} replace />;
    }

    if (username === 'opinions') {
        return <Navigate to={`/${currentLang}`} replace />;
    }

    const [profileData, setProfileData] = useState<{ id: string, question: string, tag: string }[]>([]);
    const [hoveredQuestion, setHoveredQuestion] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            if (isGuest) {
                setLoading(true);
                const stored = localStorage.getItem('opinions_answers');
                const answers = stored ? JSON.parse(stored) : {};
                const data = Object.entries(answers).map(([id, answer]) => {
                    const qData = questionsMap.get(id);
                    if (!qData) return null;
                    return {
                        id,
                        question: qData.question[currentLang],
                        tag: answer === 'yes' ? (qData.answers.yes as string) : (qData.answers.no as string)
                    };
                }).filter(Boolean) as { id: string, question: string, tag: string }[];
                setProfileData(data);
                setLoading(false);
                return;
            }

            if (!username) return;
            setLoading(true);
            try {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("username", "==", username));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setError(t.userNotFound);
                    setLoading(false);
                    return;
                }

                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                setProfileUid(userDoc.id); 
                const answers = userData.answers || {};

                const data = Object.entries(answers).map(([id, answer]) => {
                    const qData = questionsMap.get(id);
                    if (!qData) return null;
                    return {
                        id,
                        question: qData.question[currentLang],
                        tag: answer === 'yes' ? (qData.answers.yes as string) : (qData.answers.no as string)
                    };
                }).filter(Boolean) as { id: string, question: string, tag: string }[];

                setProfileData(data);
            } catch (e) {
                console.error(e);
                setError(t.errorLoadingProfile);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [username, isGuest, currentLang]);

    const handleDeleteAnswer = async (questionId: string) => {
        if (isGuest) {
             if (confirm(t.deleteConfirm)) {
                const stored = localStorage.getItem('opinions_answers');
                if (stored) {
                    const answers = JSON.parse(stored);
                    delete answers[questionId];
                    localStorage.setItem('opinions_answers', JSON.stringify(answers));
                }
                setProfileData(prev => prev.filter(item => item.id !== questionId));
             }
             return;
        }

        if (!currentUser || !profileUid || currentUser.uid !== profileUid) return;
        
        if (confirm(t.deleteConfirm)) {
            try {
                const userRef = doc(db, "users", profileUid);
                await updateDoc(userRef, {
                    [`answers.${questionId}`]: deleteField()
                });

                const stored = localStorage.getItem('opinions_answers');
                if (stored) {
                    const answers = JSON.parse(stored);
                    delete answers[questionId];
                    localStorage.setItem('opinions_answers', JSON.stringify(answers));
                }

                setProfileData(prev => prev.filter(item => item.id !== questionId));
            } catch (e) {
                console.error("Error deleting field", e);
                alert(t.deleteError);
            }
        }
    };

    if (loading) return <div className="container">{t.loading}</div>;
    if (error) return <div className="container">{error} <br/> <button className="nav-btn" onClick={() => navigate(`/${currentLang}`)}>{t.backhome}</button></div>;

    const isOwner = isGuest || (currentUser && profileUid && currentUser.uid === profileUid);

    const handleLogout = async () => {
        await logOut();
        localStorage.removeItem('opinions_answers');
        navigate(`/${currentLang}`);
    };
    
    const handleLogin = async () => {
        try {
            await signInWithGoogle();
             // Login usually redirects, we might need to handle redirect back
             // for now assumes it stays on page but auth state changes
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="container fade-in profile-container">
            <div className="app-logo" onClick={() => navigate(`/${currentLang}`)}>Opinions</div>
            <nav className="top-nav">
                    <button className="nav-btn" onClick={() => navigate(`/${currentLang}`)}>{t.backToHome}</button>
            </nav>

            <header className="profile-header">
                <span className="profile-title">
                    {isGuest ? (
                        <>{t.myProfile} <strong>{t.notConnected}</strong></>
                    ) : isOwner ? (
                        <>{t.myProfile} <strong>{username}</strong></>
                    ) : (
                        <>{t.profileOf} <strong>{username}</strong></>
                    )}
                </span>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {isGuest && (
                        <button className="nav-btn" onClick={handleLogin}>{t.login}</button>
                    )}
                    {!isGuest && isOwner && (
                        <button className="nav-btn" onClick={handleLogout}>{t.logout}</button>
                    )}
                </div>
            </header>

            <div className="tags-cloud">
                {profileData.length === 0 ? (
                    <p>{t.notAnswered}</p>
                ) : (
                    profileData.map((item) => (
                        <span
                            key={item.id}
                            className={`opinion-tag ${isOwner ? 'clickable' : ''}`}
                            onMouseEnter={() => setHoveredQuestion(item.question)}
                            onMouseLeave={() => setHoveredQuestion(null)}
                            onClick={() => isOwner && handleDeleteAnswer(item.id)}
                            title={isOwner ? "Cliquez pour supprimer cet avis" : ""}
                        >
                            {item.tag}
                        </span>
                    ))
                )}
            </div>

            <div className={hoveredQuestion ? "hovered-question-display" : "hovered-question-display fade-mid"}>
                {hoveredQuestion || t.hoverTag}
            </div>
        </div>
    );
}

function Home() {
  const { lang } = useParams<{ lang: string }>();
  const currentLang = (lang === 'fr' || lang === 'en') ? lang : 'en';
  const t = translations[currentLang];
  
  const [currentQuestion, setCurrentQuestion] = useState<AppQuestion | null>(null);
  const [fading, setFading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const navigate = useNavigate();

  if (lang !== 'fr' && lang !== 'en') {
      const browserLang = navigator.language.startsWith('fr') ? 'fr' : 'en';
      return <Navigate to={`/${browserLang}`} replace />;
  }

  const generateUID = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          let remoteAnswers = {};
          let currentUsername = null;

          if (docSnap.exists()) {
            const data = docSnap.data();
            remoteAnswers = data.answers || {};
            currentUsername = data.username;
          }

          if (!currentUsername) {
             currentUsername = generateUID();
             await setDoc(docRef, { username: currentUsername }, { merge: true });
          }
          setUsername(currentUsername);
          
          const localStored = localStorage.getItem('opinions_answers');
          const localAnswers = localStored ? JSON.parse(localStored) : {};

          const mergedAnswers = { ...localAnswers, ...remoteAnswers };
          
          if (Object.keys(mergedAnswers).length > Object.keys(remoteAnswers).length) {
              await setDoc(docRef, { answers: mergedAnswers }, { merge: true });
          }

          localStorage.setItem('opinions_answers', JSON.stringify(mergedAnswers));
        } catch (e: any) {
          console.error("Error syncing data:", e);
          alert("Erreur Firestore : " + (e.message || e));
        }
      } else {
        setUsername(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
        const user = await signInWithGoogle();
        if (user) {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            let uname = null;
            if (docSnap.exists()) {
                uname = docSnap.data().username;
            }
            if (!uname) {
                uname = generateUID();
                await setDoc(docRef, { username: uname }, { merge: true });
            }
            navigate(`/${currentLang}/${uname}`);
        }
    } catch (e: any) {
        console.error(e);
        alert("Erreur Login : " + (e.message || e));
    }
  };

  const handleProfileClick = () => {
    if (username) {
        navigate(`/${currentLang}/${username}`);
    } else {
        handleLogin();
    }
  };


  useEffect(() => {
    if (!currentQuestion && !isFinished) {
        pickRandomQuestion();
    }
  }, [currentQuestion, isFinished]);

  const pickRandomQuestion = () => {
    setFading(true);
    setTimeout(() => {
      const stored = localStorage.getItem('opinions_answers');
      const answers = stored ? JSON.parse(stored) : {};
      
      const unanswered = questions.filter(q => !answers[q.uniqueId]);
            
      if (unanswered.length > 0) {
        const randomIndex = Math.floor(Math.random() * unanswered.length);
        setCurrentQuestion(unanswered[randomIndex]);
        setIsFinished(false);
      } else {
        setIsFinished(true);
        setCurrentQuestion(null);
      }
      
      setFading(false);
    }, 300);
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion) return;
    
    const stored = localStorage.getItem('opinions_answers');
    const answers = stored ? JSON.parse(stored) : {};
    answers[currentQuestion.uniqueId] = answer;
    localStorage.setItem('opinions_answers', JSON.stringify(answers));

    if (user) {
        try {
             const docRef = doc(db, "users", user.uid);
             await setDoc(docRef, { answers }, { merge: true });
        } catch (e) {
            console.error("Error saving answer:", e);
        }
    }

    pickRandomQuestion();
  };
  
  if (isFinished) {
    return (
      <div className="container fade-in">
        <div className="app-logo">Opinions</div>
        <nav className="top-nav">
            <button className="nav-btn" onClick={handleProfileClick}>{user ? t.myProfile : t.login}</button>
        </nav>
        <div>
          <p style={{ fontSize: '1.2rem', color: '#888', marginTop: '4rem' }}>{t.finished}</p>
          <p style={{ fontSize: '1.2rem', color: '#888', marginTop: '5px' }}>{t.suggest} <a href="https://github.com/mtripnaux/opinions">GitHub</a>.</p>
          {!user && (
              <button 
                onClick={() => navigate(`/${currentLang}/local`)} 
                style={{ marginTop: '2rem', display: 'block', marginInline: 'auto' }}
            >
                {t.seeProfile}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className={`container ${fading ? 'fade-out' : 'fade-in'}`}>
      <div className="app-logo">Opinions</div>
      <nav className="top-nav">
        <button className="nav-btn" onClick={handleProfileClick}>
            {user ? t.profile : t.login}
        </button>
      </nav>
      <h1 className="question-text">{currentQuestion.text[currentLang]}</h1>
      <div className="actions">
        <button onClick={() => handleAnswer('yes')}>{t.yes}</button>
        <button onClick={() => handleAnswer('no')}>{t.no}</button>
      </div>
      <div className="footer">
        <button className="skip-btn" onClick={pickRandomQuestion}>{t.skip}</button>
      </div>
    </div>
  );
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LanguageRedirect />} />
            <Route path="/:lang" element={<Home />} />
            <Route path="/:lang/local" element={<UserProfile isGuest={true} />} />
            <Route path="/:lang/:username" element={<UserProfile />} />
        </Routes>
    );
}