import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getSubjectList } from "../../redux/subjectrelated/subjectHandle";
import axios from "axios";
import {
    Paper, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Typography, Collapse, IconButton, Card, Divider, Accordion, AccordionSummary, AccordionDetails, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert
} from "@mui/material";
import { ExpandMore, Delete, Add, Visibility } from "@mui/icons-material";

const StudentSubjects = () => {
    const dispatch = useDispatch();
    const { subjects = [], loading } = useSelector((state) => state.subject);
    const { currentUser } = useSelector((state) => state.user);
    const [expandedSubject, setExpandedSubject] = useState(null);
    const [projects, setProjects] = useState({});
    const [openRequirements, setOpenRequirements] = useState(false);
    const [selectedRequirements, setSelectedRequirements] = useState([]);
    const [notification, setNotification] = useState({ open: false, message: "", severity: "success" });

    useEffect(() => {
        dispatch(getSubjectList());
    }, [dispatch]);

    const toggleExpandSubject = (subjectID) => {
        setExpandedSubject(expandedSubject === subjectID ? null : subjectID);
    };

    // Open Requirements Dialog
    const handleOpenRequirements = (requirements) => {
        setSelectedRequirements(requirements || []);
        setOpenRequirements(true);
    };

    // Handle Project Input Changes
    const handleProjectChange = (outcomeID, field, value) => {
        setProjects(prev => ({
            ...prev,
            [outcomeID]: { ...prev[outcomeID], [field]: value }
        }));
    };

    // Handle Add Project
    const handleAddProject = async (outcomeID, subjectName, topicName) => {
        if (!projects[outcomeID]?.name || !projects[outcomeID]?.credit) {
            setNotification({
                open: true,
                message: "Please fill in all fields!",
                severity: "error"
            });
            return;
        }

        const newProject = {
            name: projects[outcomeID]?.name,
            credit: projects[outcomeID]?.credit,
            assessedBy: "", // Empty for now
            date: new Date().toISOString().split('T')[0],
        };

        setProjects(prev => ({
            ...prev,
            [outcomeID]: {
                ...prev[outcomeID],
                list: [...(prev[outcomeID]?.list || []), newProject],
                name: "",
                credit: ""
            }
        }));

        // Create and send notification
        try {
            // Get the subject and outcome names for better context
            const studentName = currentUser?.name || "A student";
            
            // Create notification in the database
            await axios.post("http://localhost:5000/api/notifications", {
                message: `${studentName} submitted project "${newProject.name}" for ${topicName} in ${subjectName}`,
                studentID: currentUser?._id,
                subjectID: expandedSubject,
                outcomeID: outcomeID,
                projectName: newProject.name,
                creditRequested: newProject.credit,
                read: false,
                date: new Date()
            });

            setNotification({
                open: true,
                message: "Project submitted successfully! Teacher has been notified.",
                severity: "success"
            });
            
        } catch (error) {
            console.error("Error sending notification:", error);
            setNotification({
                open: true,
                message: "Project added, but failed to notify teacher.",
                severity: "warning"
            });
        }
    };

    // Handle Delete Project
    const handleDeleteProject = (outcomeID, index) => {
        setProjects(prev => ({
            ...prev,
            [outcomeID]: {
                ...prev[outcomeID],
                list: prev[outcomeID]?.list.filter((_, i) => i !== index)
            }
        }));
    };

    // Handle close notification
    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    return (
        <Box sx={{ padding: 3 }}>
            <Typography variant="h4" gutterBottom>
                Student Subjects
            </Typography>
            {loading ? (
                <Typography>Loading...</Typography>
            ) : (
                <Paper sx={{ width: "100%", overflow: "hidden" }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell> </TableCell> {/* Expand Icon */}
                                    <TableCell>Subject</TableCell>
                                    <TableCell align="right">Credits</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {subjects.length > 0 ? (
                                    subjects.map((subject) => (
                                        <React.Fragment key={subject._id}>
                                            {/* Subject Row */}
                                            <TableRow>
                                                <TableCell>
                                                    <IconButton onClick={() => toggleExpandSubject(subject._id)}>
                                                        {expandedSubject === subject._id ? <ExpandMore /> : <ExpandMore />}
                                                    </IconButton>
                                                </TableCell>
                                                <TableCell>{subject.name}</TableCell>
                                                <TableCell align="right">{subject.credits}</TableCell>
                                            </TableRow>

                                            {/* Collapsible Section for Outcomes */}
                                            <TableRow>
                                                <TableCell colSpan={3} sx={{ padding: 0, border: "none" }}>
                                                    <Collapse in={expandedSubject === subject._id} timeout="auto" unmountOnExit>
                                                        <Box sx={{ margin: 2, padding: 2, background: "#f5f5f5", borderRadius: 2 }}>
                                                            <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
                                                                Outcomes:
                                                            </Typography>

                                                            {subject.outcomes.length > 0 ? (
                                                                subject.outcomes.map((outcome) => (
                                                                    <Accordion key={outcome._id} sx={{ marginBottom: 1 }}>
                                                                        <AccordionSummary expandIcon={<ExpandMore />}>
                                                                            <Typography variant="h6">
                                                                                {outcome.topic}
                                                                            </Typography>
                                                                        </AccordionSummary>
                                                                        <AccordionDetails>

                                                                            {/* View Requirements Button */}
                                                                            <Button
                                                                                variant="outlined"
                                                                                startIcon={<Visibility />}
                                                                                sx={{ mt: 2 }}
                                                                                onClick={() => handleOpenRequirements(outcome.requirements)}
                                                                            >
                                                                                View Requirements
                                                                            </Button>

                                                                            {/* Student Project Submission */}
                                                                            <Accordion sx={{ mt: 2, boxShadow: 0, backgroundColor: "#f9f9f9" }}>
                                                                                <AccordionSummary expandIcon={<ExpandMore />}>
                                                                                    <Typography variant="subtitle1" sx={{ color: "#1976d2", fontWeight: "bold" }}>
                                                                                        My Projects
                                                                                    </Typography>
                                                                                </AccordionSummary>
                                                                                <AccordionDetails>
                                                                                    <Card sx={{ backgroundColor: "#ffffff", borderRadius: 2, boxShadow: 1, p: 2 }}>
                                                                                        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2 }}>
                                                                                            Submit Your Project
                                                                                        </Typography>
                                                                                        <Divider sx={{ mb: 2 }} />

                                                                                        {/* Input Fields */}
                                                                                        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                                                                                            <TextField
                                                                                                label="Project Name"
                                                                                                variant="outlined"
                                                                                                size="small"
                                                                                                value={projects[outcome._id]?.name || ""}
                                                                                                onChange={(e) => handleProjectChange(outcome._id, "name", e.target.value)}
                                                                                            />
                                                                                            <TextField
                                                                                                label="Credit Requested"
                                                                                                variant="outlined"
                                                                                                type="number"
                                                                                                size="small"
                                                                                                value={projects[outcome._id]?.credit || ""}
                                                                                                onChange={(e) => handleProjectChange(outcome._id, "credit", e.target.value)}
                                                                                            />
                                                                                            <Button
                                                                                                variant="contained"
                                                                                                color="primary"
                                                                                                startIcon={<Add />}
                                                                                                onClick={() => handleAddProject(outcome._id, subject.name, outcome.topic)}
                                                                                            >
                                                                                                Add
                                                                                            </Button>
                                                                                        </Box>

                                                                                        {/* Display Added Projects in Table */}
                                                                                        <TableContainer>
                                                                                            <Table>
                                                                                                <TableHead>
                                                                                                    <TableRow sx={{ backgroundColor: "#e0e0e0" }}>
                                                                                                        <TableCell>SN</TableCell>
                                                                                                        <TableCell>Project Name</TableCell>
                                                                                                        <TableCell>Credit</TableCell>
                                                                                                        <TableCell>Assessed By</TableCell>
                                                                                                        <TableCell>Date</TableCell>
                                                                                                        <TableCell>Action</TableCell>
                                                                                                    </TableRow>
                                                                                                </TableHead>
                                                                                                <TableBody>
                                                                                                    {projects[outcome._id]?.list?.length > 0 ? (
                                                                                                        projects[outcome._id].list.map((project, index) => (
                                                                                                            <TableRow key={index}>
                                                                                                                <TableCell>{index + 1}</TableCell>
                                                                                                                <TableCell>{project.name}</TableCell>
                                                                                                                <TableCell>{project.credit}</TableCell>
                                                                                                                <TableCell>{project.assessedBy || "-"}</TableCell>
                                                                                                                <TableCell>{project.date || "-"}</TableCell>
                                                                                                                <TableCell>
                                                                                                                    <IconButton onClick={() => handleDeleteProject(outcome._id, index)}>
                                                                                                                        <Delete color="error" />
                                                                                                                    </IconButton>
                                                                                                                </TableCell>
                                                                                                            </TableRow>
                                                                                                        ))
                                                                                                    ) : (
                                                                                                        <TableRow>
                                                                                                            <TableCell colSpan={6} align="center">
                                                                                                                No projects submitted yet.
                                                                                                            </TableCell>
                                                                                                        </TableRow>
                                                                                                    )}
                                                                                                </TableBody>
                                                                                            </Table>
                                                                                        </TableContainer>
                                                                                    </Card>
                                                                                </AccordionDetails>
                                                                            </Accordion>
                                                                        </AccordionDetails>
                                                                    </Accordion>
                                                                ))
                                                            ) : null}
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    ))
                                ) : null}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* Requirements Pop-up Dialog */}
            <Dialog open={openRequirements} onClose={() => setOpenRequirements(false)}>
                <DialogTitle>Requirements</DialogTitle>
                <DialogContent>
                    {selectedRequirements.length > 0 ? selectedRequirements.map((req, index) => (
                        <Typography key={index} sx={{ mt: 1 }}>• {req}</Typography>
                    )) : "No requirements available."}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenRequirements(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Notification Snackbar */}
            <Snackbar 
                open={notification.open} 
                autoHideDuration={6000} 
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={handleCloseNotification} severity={notification.severity}>
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default StudentSubjects;