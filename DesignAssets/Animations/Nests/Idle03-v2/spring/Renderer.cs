using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text.Json;

public static class SpringNestWaterRenderer
{
    struct C
    {
        public float R,G,B,A;
        public C(float r,float g,float b,float a){R=r;G=g;B=b;A=a;}
        public static C Mix(C x,C y,double q){float p=(float)q;return new C(x.R+(y.R-x.R)*p,x.G+(y.G-x.G)*p,x.B+(y.B-x.B)*p,x.A+(y.A-x.A)*p);}
    }
    sealed class Tex
    {
        public int W,H;
        public C[] P;
        public Tex(string path)
        {
            using(Bitmap bmp=new Bitmap(path))
            {
                W=bmp.Width;H=bmp.Height;P=new C[W*H];
                Rectangle rect=new Rectangle(0,0,W,H);
                BitmapData data=bmp.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
                byte[] bytes=new byte[Math.Abs(data.Stride)*H];
                Marshal.Copy(data.Scan0,bytes,0,bytes.Length);
                for(int y=0;y<H;y++)for(int x=0;x<W;x++)
                {
                    int k=y*data.Stride+x*4;
                    P[y*W+x]=new C(bytes[k+2]/255f,bytes[k+1]/255f,bytes[k]/255f,bytes[k+3]/255f);
                }
                bmp.UnlockBits(data);
            }
        }
        public C Sample(double x,double y)
        {
            x=Math.Clamp(x,0,W-1.001);y=Math.Clamp(y,0,H-1.001);
            int ix=(int)x,iy=(int)y;float fx=(float)(x-ix),fy=(float)(y-iy);
            C a=P[iy*W+ix],b=P[iy*W+ix+1],c=P[(iy+1)*W+ix],d=P[(iy+1)*W+ix+1];
            float wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
            float al=a.A*wa+b.A*wb+c.A*wc+d.A*wd;
            if(al<0.00001)return new C(0,0,0,0);
            return new C((a.R*a.A*wa+b.R*b.A*wb+c.R*c.A*wc+d.R*d.A*wd)/al,(a.G*a.A*wa+b.G*b.A*wb+c.G*c.A*wc+d.G*d.A*wd)/al,(a.B*a.A*wa+b.B*b.A*wb+c.B*c.A*wc+d.B*d.A*wd)/al,al);
        }
    }
    sealed class Fall
    {
        public double[][] Rows;
        public double Phase;
        public C[] Field=new C[96*96];
        public C[] Mean=new C[96];
        public void Bounds(double y,out double left,out double right)
        {
            int i=0;
            while(i<Rows.Length-2 && y>Rows[i+1][0])i++;
            double q=Math.Clamp((y-Rows[i][0])/(Rows[i+1][0]-Rows[i][0]),0,1);
            left=Rows[i][1]+(Rows[i+1][1]-Rows[i][1])*q;
            right=Rows[i][2]+(Rows[i+1][2]-Rows[i][2])*q;
        }
    }
    static Tex original,ripple,drop;
    static C[] canvas;
    static float[] pool;
    static Fall[] falls;
    static double period;
    static int fps,frameCount;
    static double Frac(double x){return x-Math.Floor(x);}
    static C Over(C dst,C src)
    {
        float a=src.A+dst.A*(1-src.A);
        if(a<0.00001)return new C(0,0,0,0);
        return new C((src.R*src.A+dst.R*dst.A*(1-src.A))/a,(src.G*src.A+dst.G*dst.A*(1-src.A))/a,(src.B*src.A+dst.B*dst.A*(1-src.A))/a,a);
    }
    static void Save(string path,C[] pixels,int w,int h)
    {
        using(Bitmap bmp=new Bitmap(w,h,PixelFormat.Format32bppArgb))
        {
            BitmapData data=bmp.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
            byte[] bytes=new byte[data.Stride*h];
            for(int y=0;y<h;y++)for(int x=0;x<w;x++)
            {
                C p=pixels[y*w+x];int k=y*data.Stride+x*4;
                bytes[k]=(byte)Math.Clamp((int)Math.Round(p.B*255),0,255);
                bytes[k+1]=(byte)Math.Clamp((int)Math.Round(p.G*255),0,255);
                bytes[k+2]=(byte)Math.Clamp((int)Math.Round(p.R*255),0,255);
                bytes[k+3]=(byte)Math.Clamp((int)Math.Round(p.A*255),0,255);
            }
            Marshal.Copy(bytes,0,data.Scan0,bytes.Length);bmp.UnlockBits(data);bmp.Save(path,ImageFormat.Png);
        }
    }
    static float[] Mask(GraphicsPath path,string output)
    {
        using(Bitmap big=new Bitmap(2048,2048,PixelFormat.Format32bppArgb))
        using(Graphics g=Graphics.FromImage(big))
        using(Bitmap small=new Bitmap(512,512,PixelFormat.Format32bppArgb))
        using(Graphics h=Graphics.FromImage(small))
        {
            g.SmoothingMode=SmoothingMode.AntiAlias;g.ScaleTransform(4,4);g.FillPath(Brushes.White,path);
            h.InterpolationMode=InterpolationMode.HighQualityBicubic;h.DrawImage(big,new Rectangle(0,0,512,512));
            small.Save(output,ImageFormat.Png);
        }
        Tex tex=new Tex(output);float[] mask=new float[512*512];
        for(int i=0;i<mask.Length;i++)mask[i]=tex.P[i].A;
        return mask;
    }
    static void Surface(double t)
    {
        double phase=2*Math.PI*t/period;
        for(int y=330;y<=401;y++)for(int x=105;x<=443;x++)
        {
            int i=y*512+x;double weight=pool[i];
            if(weight<=0)continue;
            double ox=(0.54*Math.Sin(phase*2+y*0.16)+0.21*Math.Sin(phase*3+x*0.10))*weight;
            double oy=0.25*Math.Cos(phase*2+x*0.11)*weight;
            canvas[i]=original.Sample(x+ox,y+oy);
        }
        for(int y=228;y<251;y++)for(int x=126;x<251;x++)
        {
            double u=(x-188)/61.0,v=(y-240)/11.0;
            double weight=Math.Clamp((1-u*u-v*v)*3,0,1);
            if(weight>0)canvas[y*512+x]=original.Sample(x+0.3*Math.Sin(phase*2+y*0.21)*weight,y+0.14*Math.Cos(phase*2+x*0.13)*weight);
        }
    }
    static C Field(Fall f,double u,double v)
    {
        u=Math.Clamp(u,0,0.9999);v=Math.Clamp(v,0,0.9999);
        double x=u*95,y=v*95;int ix=(int)x,iy=(int)y;
        return C.Mix(C.Mix(f.Field[iy*96+ix],f.Field[iy*96+ix+1],x-ix),C.Mix(f.Field[(iy+1)*96+ix],f.Field[(iy+1)*96+ix+1],x-ix),y-iy);
    }
    static void Water(double t)
    {
        for(int k=0;k<falls.Length;k++)
        {
            Fall f=falls[k];double y0=f.Rows[0][0],y1=f.Rows[f.Rows.Length-1][0];
            for(int y=(int)y0;y<=y1;y++)
            {
                f.Bounds(y,out double left,out double right);
                for(int x=(int)left;x<=right;x++)
                {
                    double u=(x-left)/(right-left),v=(y-y0)/(y1-y0);
                    double weight=Math.Clamp(Math.Min(Math.Min((x-left)/1.5,(right-x)/1.5),Math.Min((y-y0)/1.7,(y1-y)/1.7)),0,1);
                    if(weight<=0)continue;
                    double uv=Frac(v-t*1.0+f.Phase);
                    double uu=Math.Clamp(u+0.012*Math.Sin(v*5+t*Math.PI*2),0,0.999);
                    C baseColor=original.P[y*512+x],sample=Field(f,uu,uv),mean=f.Mean[Math.Clamp((int)(u*95),0,95)];
                    double window=Math.Pow(Math.Sin(Math.PI*uv),2);
                    C color=new C((float)(0.58*baseColor.R+0.42*mean.R+0.42*window*(sample.R-mean.R)),(float)(0.58*baseColor.G+0.42*mean.G+0.42*window*(sample.G-mean.G)),(float)(0.58*baseColor.B+0.42*mean.B+0.42*window*(sample.B-mean.B)),1);
                    int i=y*512+x;canvas[i]=C.Mix(canvas[i],color,weight);
                }
            }
        }
    }
    static void Sprite(Tex tex,double x,double y,double w,double h,double opacity,bool poolClip)
    {
        int x0=Math.Max(0,(int)(x-w/2-1)),x1=Math.Min(511,(int)(x+w/2+1));
        int y0=Math.Max(0,(int)(y-h/2-1)),y1=Math.Min(511,(int)(y+h/2+1));
        for(int yy=y0;yy<=y1;yy++)for(int xx=x0;xx<=x1;xx++)
        {
            double u=(xx+0.5-(x-w/2))/w,v=(yy+0.5-(y-h/2))/h;
            if(u<0 || u>1 || v<0 || v>1)continue;
            C c=tex.Sample(u*(tex.W-1),v*(tex.H-1));int i=yy*512+xx;
            c.A*=(float)(opacity*(poolClip?pool[i]:1));canvas[i]=Over(canvas[i],c);
        }
    }
    static void Effects(double t)
    {
        for(int k=2;k>=0;k--)
        {
            double age=(Frac(t*2)+k)/3.0;
            Sprite(ripple,279-11*age,335+18*age,14+135*age,1.2+10*age,0.46*Math.Pow(1-age,1.8),true);
        }
        for(int k=0;k<5;k++)
        {
            double age=Frac(t*2+k*0.173),dt=age*0.48;
            double alpha=Math.Pow(Math.Sin(Math.PI*age),0.65)*0.92;
            double x=174+(k-1.6)*5.0*dt,y=332-(28+k*2.5)*dt+80*dt*dt;
            Sprite(drop,x,y,1.7+(k%2)*0.6,2.7+(k%2)*0.7,alpha,false);
        }
    }
    public static void Run(string root,int limit)
    {
        JsonDocument json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"rig.json")));
        JsonElement rig=json.RootElement;
        fps=rig.GetProperty("fps").GetInt32();frameCount=rig.GetProperty("frameCount").GetInt32();period=rig.GetProperty("periodMs").GetDouble()/1000;
        string parts=Path.Combine(root,"Parts");original=new Tex(Path.Combine(root,"Sources","reference.png"));
        ripple=new Tex(Path.Combine(root,"Sources","ripple-ring.png"));drop=new Tex(Path.Combine(root,"Sources","droplet.png"));
        using(GraphicsPath p=new GraphicsPath())
        {
            p.AddPolygon(new PointF[]{new PointF(110,352),new PointF(188,336),new PointF(310,334),new PointF(401,341),new PointF(436,354),new PointF(427,375),new PointF(366,390),new PointF(301,398),new PointF(220,399),new PointF(149,386),new PointF(113,368)});
            pool=Mask(p,Path.Combine(parts,"pool-mask.png"));
        }
        JsonElement water=rig.GetProperty("waterfalls");falls=new Fall[water.GetArrayLength()];
        for(int k=0;k<falls.Length;k++)
        {
            Fall f=new Fall();f.Phase=water[k].GetProperty("phase").GetDouble();JsonElement rows=water[k].GetProperty("rows");f.Rows=new double[rows.GetArrayLength()][];
            for(int i=0;i<f.Rows.Length;i++)f.Rows[i]=new double[]{rows[i][0].GetDouble(),rows[i][1].GetDouble(),rows[i][2].GetDouble()};
            for(int v=0;v<96;v++)
            {
                double y=f.Rows[0][0]+(f.Rows[f.Rows.Length-1][0]-f.Rows[0][0])*v/95;
                f.Bounds(y,out double l,out double r);
                for(int u=0;u<96;u++)f.Field[v*96+u]=original.Sample(l+(r-l)*u/95,y);
            }
            for(int u=0;u<96;u++)
            {
                float r=0,g=0,b=0;for(int v=0;v<96;v++){C c=f.Field[v*96+u];r+=c.R;g+=c.G;b+=c.B;}
                f.Mean[u]=new C(r/96,g/96,b/96,1);
            }
            falls[k]=f;
            Save(Path.Combine(parts,"water-"+water[k].GetProperty("name").GetString()+".png"),f.Field,96,96);
        }
        Directory.CreateDirectory(Path.Combine(root,"Frames"));
        int count=limit>0?Math.Min(limit,frameCount):frameCount+1;
        for(int frame=0;frame<count;frame++)
        {
            double t=frame/(double)fps;canvas=(C[])original.P.Clone();Surface(t);Water(t);Effects(t);
            string output=frame==frameCount?Path.Combine(root,"loop-end-check.png"):Path.Combine(root,"Frames","frame-"+frame.ToString("000")+".png");
            Save(output,canvas,512,512);
        }
        json.Dispose();
    }
}
