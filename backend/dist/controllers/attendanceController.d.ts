import { Request, Response } from 'express';
export declare const attendanceController: {
    recordAttendance(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getAttendanceByCourse(req: Request, res: Response): Promise<void>;
    getStudentAttendance(req: Request, res: Response): Promise<void>;
};
//# sourceMappingURL=attendanceController.d.ts.map