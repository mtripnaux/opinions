import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import questionsRaw from './questions.json';
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteField, getDocs, collection, query, where } from 'firebase/firestore';

interface QuestionData {
  id: string;
  question: {
    fr: string;
  };
  answers: {
    yes: string;
    no: string;
  };
}

interface AppQuestion {
  uniqueId: string;
  text: string;
}

const questionsMap = new Map((questionsRaw as QuestionData[]).map(q => [q.id, q]));
const questions: AppQuestion[] = (questionsRaw as QuestionData[]).map((q) => ({
  uniqueId: q.id,
  text: q.question.fr
}));

function UserProfile({ isGuest }: { isGuest?: boolean }) {
    const { username } = useParams();

    if (username === 'opinions') {
        return <Navigate to="/" replace />;
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
                    const q = questionsMap.get(id);
                    if (!q) return null;
                    return {
                        id,
                        question: q.question.fr,
                        tag: answer === 'yes' ? (q.answers.yes as string) : (q.answers.no as string)
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
                    setError("Utilisateur introuvable.");
                    setLoading(false);
                    return;
                }

                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                setProfileUid(userDoc.id); 
                const answers = userData.answers || {};

                const data = Object.entries(answers).map(([id, answer]) => {
                    const q = questionsMap.get(id);
                    if (!q) return null;
                    return {
                        id,
                        question: q.question.fr,
                        tag: answer === 'yes' ? (q.answers.yes as string) : (q.answers.no as string)
                    };
                }).filter(Boolean) as { id: string, question: string, tag: string }[];

                setProfileData(data);
            } catch (e) {
                console.error(e);
                setError("Erreur lors du chargement du profil.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [username, isGuest]);

    const handleDeleteAnswer = async (questionId: string) => {
        if (isGuest) {
             if (confirm("Voulez-vous supprimer cet avis ?")) {
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
        
        if (confirm("Voulez-vous supprimer cet avis ?")) {
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
                alert("Erreur lors de la suppression.");
            }
        }
    };

    if (loading) return <div className="container">Chargement...</div>;
    if (error) return <div className="container">{error} <br/> <button className="nav-btn" onClick={() => navigate('/')}>Retour à l'accueil</button></div>;

    const isOwner = isGuest || (currentUser && profileUid && currentUser.uid === profileUid);

    const handleLogout = async () => {
        await logOut();
        navigate('/');
    };
    
    const handleLogin = async () => {
        try {
            await signInWithGoogle();
            navigate('/');
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="container fade-in profile-container">
            <div className="app-logo" onClick={() => navigate('/')}>Opinions</div>
            <nav className="top-nav">
                    <button className="nav-btn" onClick={() => navigate('/')}>Aller au quiz</button>
            </nav>

            <header className="profile-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="nav-btn">
                    {isGuest ? (
                        <>Mon profil <strong>(non connecté)</strong></>
                    ) : isOwner ? (
                        <>Mon profil <strong>{username}</strong></>
                    ) : (
                        <>Profil de <strong>{username}</strong></>
                    )}
                </span>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {isGuest && (
                        <button className="nav-btn" onClick={handleLogin}>S'enregistrer</button>
                    )}
                    {!isGuest && isOwner && (
                        <button className="nav-btn" onClick={handleLogout}>Se déconnecter</button>
                    )}
                </div>
            </header>

            <div className="tags-cloud">
                {profileData.length === 0 ? (
                    <p>Cet utilisateur n'a pas encore répondu aux questions.</p>
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
                {hoveredQuestion || "Survolez un tag pour voir la question associée"}
            </div>
        </div>
    );
}

function Home() {
  const [currentQuestion, setCurrentQuestion] = useState<AppQuestion | null>(null);
  const [fading, setFading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const navigate = useNavigate();

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
            navigate(`/${uname}`);
        }
    } catch (e: any) {
        console.error(e);
        alert("Erreur Login : " + (e.message || e));
    }
  };

  const handleProfileClick = () => {
    if (username) {
        navigate(`/${username}`);
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
            <button className="nav-btn" onClick={handleProfileClick}>{user ? 'Mon profil' : 'Se connecter'}</button>
        </nav>
        <div>
          <p style={{ fontSize: '1.2rem', color: '#888', marginTop: '4rem' }}>Vous avez répondu à toutes les questions.</p>
          <p style={{ fontSize: '1.2rem', color: '#888', marginTop: '5px' }}>Suggérez de nouvelles questions sur <a href="https://github.com/mtripnaux/opinions">GitHub</a>.</p>
          {!user && (
              <button 
                onClick={() => navigate('/local')} 
                style={{ marginTop: '2rem', display: 'block', marginInline: 'auto' }}
            >
                Voir votre profil
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
            {user ? 'Profil' : 'Se connecter'}
        </button>
      </nav>
      <h1 className="question-text">{currentQuestion.text}</h1>
      <div className="actions">
        <button onClick={() => handleAnswer('yes')}>Oui</button>
        <button onClick={() => handleAnswer('no')}>Non</button>
      </div>
      <div className="footer">
        <button className="skip-btn" onClick={pickRandomQuestion}>Passer cette question</button>
      </div>
    </div>
  );
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/local" element={<UserProfile isGuest={true} />} />
            <Route path="/:username" element={<UserProfile />} />
        </Routes>
    );
}
