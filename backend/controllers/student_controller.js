const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Student = require('../models/studentSchema.js');
const Subject = require('../models/subjectSchema');

// ✅ Register Student
const studentRegister = async (req, res) => {
    try {
        const { email, password, teacherID } = req.body;

        if (!email || !password) {  
            return res.status(400).json({ message: "Email and password are required" });
        }

        const existingStudent = await Student.findOne({ email });
        if (existingStudent) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hashedPass = await bcrypt.hash(password, 10);
        const student = new Student({ email, password: hashedPass, teacherID });

        // Get all current subjects from master list to assign to the new student
        const masterSubjects = await Subject.find();
        
        // Create snapshot copies of each subject for the student
        student.assignedSubjects = masterSubjects.map(subject => ({
            subjectId: subject._id,
            name: subject.name,
            credits: subject.credits,
            outcomes: subject.outcomes.map(outcome => ({
                outcomeId: outcome._id,
                topic: outcome.topic,
                project: outcome.project,
                credits: outcome.credits,
                compulsory: outcome.compulsory,
                requirements: outcome.requirements || [],
                completed: false,
                projects: [] // Initialize empty projects array
            }))
        }));

        const result = await student.save();
        res.status(201).json(result);
    } catch (err) {
        console.error("❌ Error in studentRegister:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};

// ✅ Student Login
const studentLogIn = async (req, res) => {
    try {
        const { email, password } = req.body;

        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(404).json({ message: "Student not found!" });
        }

        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials!" });
        }

        const token = jwt.sign({ id: student._id, role: "Student" }, process.env.JWT_SECRET, { expiresIn: "1d" });
        student.password = undefined; // Hide password from response

        res.status(200).json({ token, student });
    } catch (err) {
        console.error("❌ Error in studentLogIn:", err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

// ✅ Get All Students
const getStudents = async (req, res) => {
    try {
        let students = await Student.find().select("-password"); // Do not fetch passwords

        if (students.length === 0) {
            return res.status(404).json({ message: "No students found" });
        }

        res.status(200).json(students); 
    } catch (err) {
        console.error("❌ Error fetching students:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};

// ✅ Get Single Student Details
const getStudentDetail = async (req, res) => {
    try {
        let student = await Student.findById(req.params.id)
            .populate("sclassName", "sclassName")
            .populate("school", "schoolName")
            .populate("examResult.subName", "subName");

        if (!student) {
            return res.status(404).json({ message: "No student found" });
        }

        student.password = undefined;
        res.send(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ Delete All Students of a School
const deleteStudents = async (req, res) => {
    try {
        const result = await Student.deleteMany({ school: req.params.id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "No students found to delete" });
        }

        res.send({ message: `${result.deletedCount} students deleted` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ✅ Delete Single Student
const deleteStudent = async (req, res) => {
    try {
        const result = await Student.findByIdAndDelete(req.params.id);

        if (!result) {
            return res.status(404).json({ message: "Student not found" });
        }

        res.send({ message: "Student deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ✅ Update Student Details
const updateStudent = async (req, res) => {
    try {
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(req.body.password, salt);
        }

        let result = await Student.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ message: "Student not found" });
        }

        result.password = undefined;
        res.send(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ✅ Delete All Students in a Specific Class
const deleteStudentsByClass = async (req, res) => {
    try {
        const result = await Student.deleteMany({ sclassName: req.params.id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "No students found to delete in this class" });
        }

        res.send({ message: `${result.deletedCount} students deleted from the class` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ✅ Update Student Exam Results
const updateExamResult = async (req, res) => {
    const { subName, marksObtained } = req.body;

    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const existingResult = student.examResult.find(
            (result) => result.subName.toString() === subName
        );

        if (existingResult) {
            existingResult.marksObtained = marksObtained;
        } else {
            student.examResult.push({ subName, marksObtained });
        }

        const result = await student.save();
        res.send(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get student's assigned subjects
const getStudentSubjects = async (req, res) => {
    try {
        const studentID = req.params.studentID;

        // Find the student with their assigned subjects
        const student = await Student.findById(studentID);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Check if student has assigned subjects
        if (!student.assignedSubjects || student.assignedSubjects.length === 0) {
            // If student doesn't have assigned subjects yet, assign them from the master list
            await assignSubjectsToStudent(studentID);
            // Refetch the student with the newly assigned subjects
            const updatedStudent = await Student.findById(studentID);
            return res.status(200).json(updatedStudent.assignedSubjects);
        }

        // Return the student's assigned subjects
        res.status(200).json(student.assignedSubjects);
    } catch (error) {
        console.error("Error in getStudentSubjects:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

// Function to assign current master subjects to an existing student
const assignSubjectsToStudent = async (studentID) => {
    try {
        // Find the student
        const student = await Student.findById(studentID);
        if (!student) {
            throw new Error("Student not found");
        }
        
        // Get all current subjects from master list
        const masterSubjects = await Subject.find();
        
        // Create snapshot copies of each subject for the student
        student.assignedSubjects = masterSubjects.map(subject => ({
            subjectId: subject._id,
            name: subject.name,
            credits: subject.credits,
            outcomes: subject.outcomes.map(outcome => ({
                outcomeId: outcome._id,
                topic: outcome.topic,
                project: outcome.project,
                credits: outcome.credits,
                compulsory: outcome.compulsory,
                requirements: outcome.requirements || [],
                completed: false,
                projects: [] // Initialize empty projects array
            }))
        }));
        
        await student.save();
        return student;
    } catch (error) {
        console.error("Error assigning subjects to student:", error);
        throw error;
    }
};

// API endpoint to manually assign current subjects to a student
const assignCurrentSubjectsToStudent = async (req, res) => {
    try {
        const studentID = req.params.studentID;
        const student = await assignSubjectsToStudent(studentID);
        
        res.status(200).json({ 
            message: "Subjects assigned successfully", 
            assignedSubjects: student.assignedSubjects 
        });
    } catch (error) {
        console.error("Error in assignCurrentSubjectsToStudent:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

// Update a student's progress on a specific outcome
const updateOutcomeProgress = async (req, res) => {
    try {
        const { studentID, subjectID, outcomeID } = req.params;
        const { completed } = req.body;

        const student = await Student.findById(studentID);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Find the subject in the student's assigned subjects
        const subjectIndex = student.assignedSubjects.findIndex(
            subject => subject.subjectId.toString() === subjectID
        );

        if (subjectIndex === -1) {
            return res.status(404).json({ message: "Subject not found in student's assigned subjects" });
        }

        // Find the outcome in the subject
        const outcomeIndex = student.assignedSubjects[subjectIndex].outcomes.findIndex(
            outcome => outcome.outcomeId.toString() === outcomeID
        );

        if (outcomeIndex === -1) {
            return res.status(404).json({ message: "Outcome not found in subject" });
        }

        // Update the completed status
        student.assignedSubjects[subjectIndex].outcomes[outcomeIndex].completed = completed;
        await student.save();

        res.status(200).json({ 
            message: "Outcome progress updated successfully", 
            outcome: student.assignedSubjects[subjectIndex].outcomes[outcomeIndex] 
        });
    } catch (error) {
        console.error("Error updating outcome progress:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

// NEW METHOD: Submit a project for an outcome
const submitProject = async (req, res) => {
    try {
        const { studentID, subjectID, outcomeID } = req.params;
        const { name, requestedCredit } = req.body;
        
        if (!name || !requestedCredit) {
            return res.status(400).json({ message: "Project name and requested credit are required" });
        }
        
        const student = await Student.findById(studentID);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        
        // Find the subject in student's assigned subjects
        const subjectIndex = student.assignedSubjects.findIndex(
            subject => subject.subjectId.toString() === subjectID
        );
        
        if (subjectIndex === -1) {
            return res.status(404).json({ message: "Subject not found in student's assigned subjects" });
        }
        
        // Find the outcome in the subject
        const outcomeIndex = student.assignedSubjects[subjectIndex].outcomes.findIndex(
            outcome => outcome.outcomeId.toString() === outcomeID
        );
        
        if (outcomeIndex === -1) {
            return res.status(404).json({ message: "Outcome not found in subject" });
        }
        
        // Add the new project to the outcome's projects array
        student.assignedSubjects[subjectIndex].outcomes[outcomeIndex].projects.push({
            name,
            requestedCredit: Number(requestedCredit),
            status: 'Pending',
            submissionDate: new Date()
        });
        
        await student.save();
        
        res.status(201).json({ 
            message: "Project submitted successfully", 
            project: student.assignedSubjects[subjectIndex].outcomes[outcomeIndex].projects.slice(-1)[0] 
        });
    } catch (error) {
        console.error("Error submitting project:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

// NEW METHOD: For teachers to assess a student's project
const assessProject = async (req, res) => {
    try {
        const { studentID, subjectID, outcomeID, projectID } = req.params;
        const { approvedCredit, assessedBy, status, assessment } = req.body;
        
        if (!status || (status === 'Approved' && !approvedCredit)) {
            return res.status(400).json({ 
                message: "Status is required. If approving, approved credit is also required." 
            });
        }
        
        const student = await Student.findById(studentID);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        
        // Find the subject
        const subjectIndex = student.assignedSubjects.findIndex(
            subject => subject.subjectId.toString() === subjectID
        );
        
        if (subjectIndex === -1) {
            return res.status(404).json({ message: "Subject not found" });
        }
        
        // Find the outcome
        const outcomeIndex = student.assignedSubjects[subjectIndex].outcomes.findIndex(
            outcome => outcome.outcomeId.toString() === outcomeID
        );
        
        if (outcomeIndex === -1) {
            return res.status(404).json({ message: "Outcome not found" });
        }
        
        // Find the project
        const projectIndex = student.assignedSubjects[subjectIndex].outcomes[outcomeIndex].projects.findIndex(
            project => project._id.toString() === projectID
        );
        
        if (projectIndex === -1) {
            return res.status(404).json({ message: "Project not found" });
        }
        
        // Update the project
        const project = student.assignedSubjects[subjectIndex].outcomes[outcomeIndex].projects[projectIndex];
        
        project.status = status;
        if (status === 'Approved' && approvedCredit) {
            project.approvedCredit = Number(approvedCredit);
        }
        if (assessedBy) {
            project.assessedBy = assessedBy;
        }
        if (assessment) {
            project.assessment = assessment;
        }
        
        // If project is approved, mark the outcome as completed
        if (status === 'Approved') {
            student.assignedSubjects[subjectIndex].outcomes[outcomeIndex].completed = true;
        }
        
        await student.save();
        
        res.status(200).json({ 
            message: "Project assessment updated successfully", 
            project: student.assignedSubjects[subjectIndex].outcomes[outcomeIndex].projects[projectIndex] 
        });
    } catch (error) {
        console.error("Error assessing project:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

// NEW METHOD: Get all projects for a specific outcome
const getOutcomeProjects = async (req, res) => {
    try {
        const { studentID, subjectID, outcomeID } = req.params;
        
        const student = await Student.findById(studentID);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        
        // Find the subject
        const subject = student.assignedSubjects.find(
            subject => subject.subjectId.toString() === subjectID
        );
        
        if (!subject) {
            return res.status(404).json({ message: "Subject not found" });
        }
        
        // Find the outcome
        const outcome = subject.outcomes.find(
            outcome => outcome.outcomeId.toString() === outcomeID
        );
        
        if (!outcome) {
            return res.status(404).json({ message: "Outcome not found" });
        }
        
        res.status(200).json(outcome.projects || []);
    } catch (error) {
        console.error("Error fetching outcome projects:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

module.exports = {
    studentRegister,
    studentLogIn, 
    getStudents, 
    getStudentDetail,
    deleteStudents,
    deleteStudent,
    updateStudent,
    deleteStudentsByClass,
    updateExamResult,
    getStudentSubjects,
    assignCurrentSubjectsToStudent,
    updateOutcomeProgress,
    // New methods
    submitProject,
    assessProject,
    getOutcomeProjects
};