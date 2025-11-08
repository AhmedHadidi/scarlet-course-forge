import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
import { Plus, Edit, Trash2, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

interface Course {
  id: string;
  title: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  course_id: string;
  passing_score: number;
  courses: { title: string };
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
}

interface Answer {
  id: string;
  answer_text: string;
  is_correct: boolean;
}

export const QuizManagement = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: Answer[] }>({});

  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    course_id: "",
    passing_score: 70,
  });

  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    question_type: "multiple_choice",
    answers: [
      { answer_text: "", is_correct: false },
      { answer_text: "", is_correct: false },
    ],
  });

  useEffect(() => {
    fetchCourses();
    fetchQuizzes();
  }, []);

  useEffect(() => {
    if (selectedQuiz) {
      fetchQuestions(selectedQuiz);
    }
  }, [selectedQuiz]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title")
      .eq("is_published", true)
      .order("title");

    if (error) {
      sonnerToast.error("Failed to fetch courses");
      return;
    }
    setCourses(data || []);
  };

  const fetchQuizzes = async () => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*, courses(title)")
      .order("created_at", { ascending: false });

    if (error) {
      sonnerToast.error("Failed to fetch quizzes");
      return;
    }
    setQuizzes(data || []);
  };

  const fetchQuestions = async (quizId: string) => {
    const { data: questionsData, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order_index");

    if (questionsError) {
      sonnerToast.error("Failed to fetch questions");
      return;
    }
    setQuestions(questionsData || []);

    // Fetch answers for all questions
    if (questionsData && questionsData.length > 0) {
      const questionIds = questionsData.map((q) => q.id);
      const { data: answersData, error: answersError } = await supabase
        .from("quiz_answers")
        .select("*")
        .in("question_id", questionIds);

      if (!answersError && answersData) {
        const answersMap: { [key: string]: Answer[] } = {};
        answersData.forEach((answer) => {
          if (!answersMap[answer.question_id]) {
            answersMap[answer.question_id] = [];
          }
          answersMap[answer.question_id].push(answer);
        });
        setAnswers(answersMap);
      }
    }
  };

  const handleSaveQuiz = async () => {
    if (!quizForm.title || !quizForm.course_id) {
      sonnerToast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingQuiz) {
        const { error } = await supabase
          .from("quizzes")
          .update({
            title: quizForm.title,
            description: quizForm.description,
            passing_score: quizForm.passing_score,
          })
          .eq("id", editingQuiz.id);

        if (error) throw error;
        sonnerToast.success("Quiz updated successfully");
      } else {
        const { error } = await supabase.from("quizzes").insert({
          title: quizForm.title,
          description: quizForm.description,
          course_id: quizForm.course_id,
          passing_score: quizForm.passing_score,
        });

        if (error) throw error;
        sonnerToast.success("Quiz created successfully");
      }

      setIsQuizDialogOpen(false);
      setEditingQuiz(null);
      setQuizForm({ title: "", description: "", course_id: "", passing_score: 70 });
      fetchQuizzes();
    } catch (error: any) {
      sonnerToast.error(error.message);
    }
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text || !selectedQuiz) {
      sonnerToast.error("Please fill in the question");
      return;
    }

    // Validate answers
    const validAnswers = questionForm.answers.filter((a) => a.answer_text.trim());
    if (validAnswers.length < 2) {
      sonnerToast.error("Please provide at least 2 answers");
      return;
    }

    const hasCorrectAnswer = validAnswers.some((a) => a.is_correct);
    if (!hasCorrectAnswer) {
      sonnerToast.error("Please mark at least one answer as correct");
      return;
    }

    try {
      if (editingQuestion) {
        const { error } = await supabase
          .from("quiz_questions")
          .update({
            question_text: questionForm.question_text,
            question_type: questionForm.question_type,
          })
          .eq("id", editingQuestion.id);

        if (error) throw error;

        // Delete old answers
        await supabase.from("quiz_answers").delete().eq("question_id", editingQuestion.id);

        // Insert new answers
        const answersToInsert = validAnswers.map((answer) => ({
          question_id: editingQuestion.id,
          answer_text: answer.answer_text,
          is_correct: answer.is_correct,
        }));

        await supabase.from("quiz_answers").insert(answersToInsert);

        sonnerToast.success("Question updated successfully");
      } else {
        const { data: questionData, error: questionError } = await supabase
          .from("quiz_questions")
          .insert({
            quiz_id: selectedQuiz,
            question_text: questionForm.question_text,
            question_type: questionForm.question_type,
            order_index: questions.length,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        const answersToInsert = validAnswers.map((answer) => ({
          question_id: questionData.id,
          answer_text: answer.answer_text,
          is_correct: answer.is_correct,
        }));

        await supabase.from("quiz_answers").insert(answersToInsert);

        sonnerToast.success("Question created successfully");
      }

      setIsQuestionDialogOpen(false);
      setEditingQuestion(null);
      setQuestionForm({
        question_text: "",
        question_type: "multiple_choice",
        answers: [
          { answer_text: "", is_correct: false },
          { answer_text: "", is_correct: false },
        ],
      });
      if (selectedQuiz) fetchQuestions(selectedQuiz);
    } catch (error: any) {
      sonnerToast.error(error.message);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return;

    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);

    if (error) {
      sonnerToast.error("Failed to delete quiz");
      return;
    }

    sonnerToast.success("Quiz deleted successfully");
    fetchQuizzes();
    if (selectedQuiz === quizId) {
      setSelectedQuiz(null);
      setQuestions([]);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    const { error } = await supabase.from("quiz_questions").delete().eq("id", questionId);

    if (error) {
      sonnerToast.error("Failed to delete question");
      return;
    }

    sonnerToast.success("Question deleted successfully");
    if (selectedQuiz) fetchQuestions(selectedQuiz);
  };

  const addAnswerField = () => {
    setQuestionForm({
      ...questionForm,
      answers: [...questionForm.answers, { answer_text: "", is_correct: false }],
    });
  };

  const removeAnswerField = (index: number) => {
    const newAnswers = questionForm.answers.filter((_, i) => i !== index);
    setQuestionForm({ ...questionForm, answers: newAnswers });
  };

  const updateAnswer = (index: number, field: "answer_text" | "is_correct", value: string | boolean) => {
    const newAnswers = [...questionForm.answers];
    newAnswers[index] = { ...newAnswers[index], [field]: value };
    setQuestionForm({ ...questionForm, answers: newAnswers });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Quiz Management</h2>
          <p className="text-muted-foreground">Create and manage course quizzes</p>
        </div>
        <Button onClick={() => setIsQuizDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Quiz
        </Button>
      </div>

      <Tabs value={selectedQuiz || "all"} onValueChange={setSelectedQuiz}>
        <TabsList>
          <TabsTrigger value="all">All Quizzes</TabsTrigger>
          {quizzes.map((quiz) => (
            <TabsTrigger key={quiz.id} value={quiz.id}>
              {quiz.title}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <Card key={quiz.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{quiz.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <BookOpen className="h-3 w-3" />
                        {quiz.courses.title}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingQuiz(quiz);
                          setQuizForm({
                            title: quiz.title,
                            description: quiz.description || "",
                            course_id: quiz.course_id,
                            passing_score: quiz.passing_score,
                          });
                          setIsQuizDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteQuiz(quiz.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{quiz.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Passing: {quiz.passing_score}%</Badge>
                    <Button size="sm" variant="outline" onClick={() => setSelectedQuiz(quiz.id)}>
                      Manage Questions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {quizzes.map((quiz) => (
          <TabsContent key={quiz.id} value={quiz.id} className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold">{quiz.title}</h3>
                <p className="text-sm text-muted-foreground">{questions.length} questions</p>
              </div>
              <Button onClick={() => setIsQuestionDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </div>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <Card key={question.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {index + 1}. {question.question_text}
                        </CardTitle>
                        <Badge variant="outline" className="mt-2">
                          {question.question_type.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingQuestion(question);
                            setQuestionForm({
                              question_text: question.question_text,
                              question_type: question.question_type,
                              answers:
                                answers[question.id]?.map((a) => ({
                                  answer_text: a.answer_text,
                                  is_correct: a.is_correct,
                                })) || [],
                            });
                            setIsQuestionDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(question.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {answers[question.id]?.map((answer, idx) => (
                        <div key={answer.id} className="flex items-center gap-2">
                          <Badge variant={answer.is_correct ? "default" : "secondary"}>
                            {String.fromCharCode(65 + idx)}
                          </Badge>
                          <span className="text-sm">{answer.answer_text}</span>
                          {answer.is_correct && <Badge variant="default">Correct</Badge>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Quiz Dialog */}
      <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? "Edit Quiz" : "Create New Quiz"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quiz-title">Title *</Label>
              <Input
                id="quiz-title"
                value={quizForm.title}
                onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                placeholder="Enter quiz title"
              />
            </div>
            <div>
              <Label htmlFor="quiz-description">Description</Label>
              <Textarea
                id="quiz-description"
                value={quizForm.description}
                onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                placeholder="Enter quiz description"
              />
            </div>
            <div>
              <Label htmlFor="quiz-course">Course *</Label>
              <Select
                value={quizForm.course_id}
                onValueChange={(value) => setQuizForm({ ...quizForm, course_id: value })}
                disabled={!!editingQuiz}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="passing-score">Passing Score (%)</Label>
              <Input
                id="passing-score"
                type="number"
                min="0"
                max="100"
                value={quizForm.passing_score}
                onChange={(e) => setQuizForm({ ...quizForm, passing_score: parseInt(e.target.value) || 70 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuizDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuiz}>{editingQuiz ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add New Question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="question-text">Question *</Label>
              <Textarea
                id="question-text"
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                placeholder="Enter your question"
              />
            </div>
            <div>
              <Label htmlFor="question-type">Question Type</Label>
              <Select
                value={questionForm.question_type}
                onValueChange={(value) => setQuestionForm({ ...questionForm, question_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="single_answer">Single Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Answers</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAnswerField}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Answer
                </Button>
              </div>
              {questionForm.answers.map((answer, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id={`correct-${index}`}
                      checked={answer.is_correct}
                      onCheckedChange={(checked) => updateAnswer(index, "is_correct", !!checked)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder={`Answer ${index + 1}`}
                      value={answer.answer_text}
                      onChange={(e) => updateAnswer(index, "answer_text", e.target.value)}
                    />
                  </div>
                  {questionForm.answers.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAnswerField(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Check the box to mark correct answer(s)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion}>{editingQuestion ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
