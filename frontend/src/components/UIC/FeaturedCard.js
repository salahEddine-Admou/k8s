import React from "react";
import { useNavigate } from "react-router-dom"

export default function FeaturedCard(props) {
    const navigate = useNavigate()
    const visitDetails = () => {
        navigate(`/experiencedetails/${props.id}`)
    }
  return (
    <div>
      <div className="card" style={{ marginBottom: "2%", marginTop: "2%"}}>
        <div className="card-header">Featured</div>
        <div className="card-body">
          <h5 className="card-title">{props.title}</h5>
          <h6 className="card-subtitle mb-2 text-body-secondary">{props.tripType}</h6>
          <p className="card-text">
            {props.description}
          </p>
          <button className="btn btn-success" onClick={visitDetails}>
            More Details
          </button>
        </div>
      </div>
    </div>
  );
}
