import { Request, Response } from 'express';
export declare const courseController: {
    getAllCourses(req: Request, res: Response): Promise<void>;
    getTeacherCourses(req: Request, res: Response): Promise<void>;
    getStudentCourses(req: Request, res: Response): Promise<void>;
    createCourse(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    enrollCourse(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=courseController.d.ts.map